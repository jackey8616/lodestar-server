import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';

import { AuthService } from './auth.service';
import { CrossServerTokenDTO } from './auth.type';

@Controller({
  path: 'auth',
  version: ['2'],
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('token')
  async generateCrossServerToken(@Body() body: CrossServerTokenDTO) {
    const authToken = await this.authService.generateCrossServerToken(body);
    return {
      code: 'SUCCESS',
      message: 'get auth token successfully',
      result: { authToken },
    };
  }

  @Post('/sign-cloudfront-cookies') signCookie(@Res() res: Response, @Body() body: { url: string }) {
    const cookies = this.authService.signCloudfrontCookies(body.url);
    res.cookie('CloudFront-Expires', cookies['CloudFront-Expires']);
    res.cookie('CloudFront-Key-Pair-Id', cookies['CloudFront-Key-Pair-Id']);
    res.cookie('CloudFront-Signature', cookies['CloudFront-Signature']);
    res.send('success set cookie');
  }
}
