import { Controller  } from '@nestjs/common';

@Controller('user')

export class UserController {

    @Get()
    findAll(){
        return []
    }
}
