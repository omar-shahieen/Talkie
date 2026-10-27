import { ExecutionContext, Injectable } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const http = context.switchToHttp();
    const req = http.getRequest();

    if (!this.isRequestCacheable(context)) {
      return undefined;
    }

    // Do not cache personal user profile
    if (req?.url?.includes('/users/me')) {
      return undefined;
    }

    if (req?.user?.id) {
      return `${req.user.id}:${req.url}`;
    }

    const tracked = super.trackBy(context);
    if (!tracked) return undefined;
    return typeof tracked === 'string' ? tracked : undefined;
  }
}
