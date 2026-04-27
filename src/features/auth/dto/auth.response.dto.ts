import { ApiProperty } from "@nestjs/swagger";
import { UserDTO } from "../../user/dto/user.dto";

export class AuthResponseDTO {
    @ApiProperty({
        description: 'JWT access token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    })
    accessToken!: string;
    
    @ApiProperty({
        description: 'userDetails',
        example: {
            id: 1,
            email: 'john.doe@example.com',
            roles: ['admin', 'customer', 'conductor']
        }

    })
    user!: UserDTO;;
}