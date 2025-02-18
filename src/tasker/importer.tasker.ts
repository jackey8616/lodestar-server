import { Job, Queue } from 'bull';
import * as XLSX from 'xlsx';
import { EntityManager } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { BullModule, InjectQueue, Process, Processor } from '@nestjs/bull';
import { DynamicModule, Logger } from '@nestjs/common';

import { DefinitionModule } from '~/definition/definition.module';
import { MemberInfrastructure } from '~/member/member.infra';
import { MemberService } from '~/member/member.service';
import { Member } from '~/member/entity/member.entity';
import { MemberImportResultDTO } from '~/member/member.dto';
import { UtilityModule } from '~/utility/utility.module';
import { StorageService } from '~/utility/storage/storage.service';

import { Tasker } from './tasker';
import { MailJob } from './mailer.tasker';

export type ImportCategory = 'member';

export class ImportJob {
  appId: string;
  invokerMemberId: string;
  category: ImportCategory;
  fileInfos: Array<{
    checksumETag: string;
    fileName: string;
  }>;
}

@Processor(ImporterTasker.name)
export class ImporterTasker extends Tasker {
  static forRoot(): DynamicModule {
    return {
      module: ImporterTasker,
      imports: [
        UtilityModule,
        DefinitionModule,
        // BullModule.registerQueue({ name: MailerTasker.name }),
        BullModule.registerQueue({ name: 'mailer' }),
      ],
      providers: [StorageService, MemberService, MemberInfrastructure],
    };
  }

  constructor(
    protected readonly logger: Logger,
    private readonly storageService: StorageService,
    private readonly memberService: MemberService,
    private readonly memberInfra: MemberInfrastructure,
    // @InjectQueue(MailerTasker.name) private readonly mailerQueue: Queue,
    @InjectQueue('mailer') private readonly mailerQueue: Queue,
    @InjectEntityManager() private readonly entityManager: EntityManager,
  ) {
    super(logger);
  }

  @Process()
  async process(job: Job<ImportJob>): Promise<void> {
    this.preProcess();
    try {
      const { id } = job;
      this.logger.log(`Import task: ${id} processing.`);

      const { appId, invokerMemberId, category, fileInfos }: ImportJob = job.data;
      const invokers = await this.memberInfra.getMembersByConditions(
        appId,
        { id: invokerMemberId },
        this.entityManager,
      );
      const admins = await this.memberInfra.getMembersByConditions(appId, { role: 'app-owner' }, this.entityManager);
      const processResult: Record<string, MemberImportResultDTO | Error> = {};

      for (const fileInfo of fileInfos) {
        const { checksumETag, fileName } = fileInfo;

        try {
          const insertResult = await this.processFiles(appId, fileName, checksumETag, category);
          await this.storageService.deleteFileAtBucketStorage({
            Key: `${appId}/${fileName}`,
          });
          processResult[fileName] = insertResult;
        } catch (err) {
          processResult[fileName] = err;
        }
      }
      await this.memberInfra.insertMemberAuditLog(
        invokers,
        fileInfos.map(({ fileName }) => fileName).join(', '),
        'upload',
        this.entityManager,
      );
      this.logger.log(`import process result: ${JSON.stringify(processResult)}`);

      await this.putEmailQueue(
        appId,
        [...invokers, ...admins],
        '匯入結果(MemberImport)',
        JSON.stringify(processResult),
      );
      this.logger.log(`Import task: ${id} completed.`);
    } catch (error) {
      this.logger.error('Import task error:');
      this.logger.error(error);
    } finally {
      this.postProcess();
    }
  }

  private async processFiles(
    appId: string,
    fileName: string,
    checksumETag: string,
    category: ImportCategory,
  ): Promise<MemberImportResultDTO> {
    const { ContentType, Body, ETag } = await this.storageService.getFileFromBucketStorage({
      Key: `${appId}/${fileName}`,
    });

    if (`"${checksumETag}"` !== ETag) {
      throw new Error('Unmatched checksum.');
    }
    const uint8Array = await Body.transformToByteArray();

    return this.importToDatabase(appId, category, ContentType, Buffer.from(uint8Array));
  }

  private importToDatabase(
    appId: string,
    category: ImportCategory,
    mimeType: string,
    rawBin: Buffer,
  ): Promise<MemberImportResultDTO> {
    let rawRows: Array<Record<string, any>> = [];
    let data: XLSX.WorkBook;

    switch (mimeType) {
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        data = XLSX.read(rawBin);
        break;
      case 'text/csv':
      default:
        const decodedRaw = new TextDecoder().decode(rawBin);
        data = XLSX.read(decodedRaw, { type: 'string' });
        break;
    }
    const { Sheets, SheetNames } = data;
    rawRows = XLSX.utils.sheet_to_json(Sheets[SheetNames[0]], { defval: '', raw: false });

    switch (category) {
      case 'member':
        return this.memberService.processImportFromFile(appId, rawRows);
    }
  }

  private async putEmailQueue(
    appId: string,
    invokerMember: Array<Member>,
    subject: string,
    content: string,
  ): Promise<void> {
    this.mailerQueue.add({
      appId,
      to: invokerMember.map(({ email }) => email),
      subject,
      cc: [],
      bcc: [],
      content: `<html>
        <body>
          ${content}
        </body>
      </html>`,
    } as MailJob);
  }
}
