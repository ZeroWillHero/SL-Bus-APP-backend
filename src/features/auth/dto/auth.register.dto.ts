import { ApiProperty } from "@nestjs/swagger";
import { UserDTO } from "../../user/dto/user.dto";

export class AuthRegisterDTO {
    @ApiProperty({
        description : "user Details"
    })
    user! : UserDTO
}
