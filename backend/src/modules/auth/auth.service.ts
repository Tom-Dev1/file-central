import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { RefreshTokenService } from "./refresh-token.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private refreshTokenService: RefreshTokenService
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto.email, dto.name, dto.password, dto.username);
    return this.buildAuthResponse(user._id.toString(), user.email, user.name, user.username);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.fintByUserName(dto.username);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const valid = await this.usersService.validatePassword(user, dto.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.buildAuthResponse(user._id.toString(), user.email, user.name, user.username);
  }

  /** Exchanges a valid refresh token for a new access token (and rotates the refresh token). */
  async refresh(rawRefreshToken: string) {
    const { userId, newRawToken } = await this.refreshTokenService.validateAndRotate(rawRefreshToken);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }
    const accessToken = this.signAccessToken(user._id.toString(), user.email);
    return { accessToken, refreshToken: newRawToken };
  }

  async logout(rawRefreshToken: string) {
    await this.refreshTokenService.revoke(rawRefreshToken);
    return { loggedOut: true as const };
  }

  async logoutAll(userId: string) {
    await this.refreshTokenService.revokeAllForUser(userId);
    return { loggedOutAllDevices: true as const };
  }

  private signAccessToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email });
  }

  private async buildAuthResponse(userId: string, email: string, name: string, username: string) {
    const accessToken = this.signAccessToken(userId, email);
    const refreshToken = await this.refreshTokenService.issue(userId);
    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, name, username },
    };
  }
}
