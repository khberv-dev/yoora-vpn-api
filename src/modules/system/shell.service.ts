import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);

@Injectable()
export class ShellService {
  private readonly logger = new Logger(ShellService.name);

  async run(cmd: string, args: string[] = []): Promise<string> {
    try {
      const { stdout } = await execFileAsync(cmd, args, {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      });
      return stdout.trim();
    } catch (err: any) {
      this.logger.error(
        `Command failed: ${cmd} ${args.join(' ')} -> ${err.stderr || err.message}`,
      );
      throw err;
    }
  }
}
