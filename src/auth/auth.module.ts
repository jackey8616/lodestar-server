import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AppModule } from '~/app/app.module';
import { MemberInfrastructure } from '~/member/member.infra';
import { PermissionModule } from '~/permission/permission.module';

import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  imports: [AppModule, PermissionModule],
  providers: [AuthService, MemberInfrastructure],
})
export class AuthModule {}
