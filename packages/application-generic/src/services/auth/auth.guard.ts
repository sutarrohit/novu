import {
  ExecutionContext,
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { Instrument } from '../../instrumentation';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly reflector: Reflector;

  constructor(
    @Inject(forwardRef(() => AuthService)) private authService: AuthService
  ) {
    super();
    this.reflector = new Reflector();
  }

  @Instrument()
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorizationHeader = request.headers.authorization;

    if (authorizationHeader) {
      const authScheme = authorizationHeader.split(' ')[0];
      request.authScheme = authScheme;
    }

    if (authorizationHeader && authorizationHeader.includes('ApiKey')) {
      const apiEnabled = this.reflector.get<boolean>(
        'external_api_accessible',
        context.getHandler()
      );
      if (!apiEnabled)
        throw new UnauthorizedException('API endpoint not available');

      const key = authorizationHeader.split(' ')[1];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return this.authService.apiKeyAuthenticate(key).then<any>((result) => {
        request.headers.authorization = `Bearer ${result}`;

        return true;
      });
    }

    return super.canActivate(context);
  }
}
