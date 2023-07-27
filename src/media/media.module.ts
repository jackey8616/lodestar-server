import { Logger, Module } from '@nestjs/common';

import { ProgramService } from '~/program/program.service';
import { UtilityService } from '~/utility/utility.service';

import { AudioService } from './audio/audio.service';
import { ImageService } from './image/image.service';
import { VideoService } from './video/video.service';
import { VideoController } from './video/video.controller';
import { MediaInfrastructure } from './media.infra';
import { MediaService } from './media.service';

@Module({
  controllers: [VideoController],
  providers: [
    Logger,
    AudioService,
    ImageService,
    MediaInfrastructure,
    ProgramService,
    UtilityService,
    VideoService,
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
