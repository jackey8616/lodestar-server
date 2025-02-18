import { Module, Logger, forwardRef } from '@nestjs/common';

import { AppModule } from '~/app/app.module';
import { MemberModule } from '~/member/member.module';
import { MailerModule } from '~/mailer/mailer.module';
import { PermissionModule } from '~/permission/permission.module';
import { UtilityModule } from '~/utility/utility.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthInfrastructure } from './auth.infra';
import DeviceService from './device/device.service';

@Module({
  controllers: [AuthController],
  imports: [
    AppModule,
    forwardRef(() => MemberModule),
    PermissionModule,
    MailerModule,
    UtilityModule,
  ],
  providers: [Logger, AuthService, DeviceService, AuthInfrastructure],
  exports: [AuthService],
})
export class AuthModule {}
