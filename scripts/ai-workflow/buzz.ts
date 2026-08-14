import { spawn } from 'node:child_process';
import { parseMemberRole, type DesiredMember } from './model.ts';

export interface ChannelSummary {
  channelId: string;
  name: string;
  description: string;
}

export interface BuzzGateway {
  listChannels(): Promise<ChannelSummary[]>;
  createChannel(input: {
    name: string;
    description: string;
    type: 'stream' | 'forum';
    visibility: 'open' | 'private';
  }): Promise<ChannelSummary>;
  getChannel(channelId: string): Promise<ChannelSummary>;
  listMembers(channelId: string): Promise<DesiredMember[]>;
  addMember(channelId: string, member: DesiredMember): Promise<void>;
  getCanvas(channelId: string): Promise<string | null>;
  setCanvas(channelId: string, content: string): Promise<void>;
  archiveChannel(channelId: string): Promise<void>;
}

export class BuzzCliGateway implements BuzzGateway {
  readonly binary: string;

  constructor(binary = 'buzz') {
    this.binary = binary;
  }

  async listChannels() {
    const output = await this.run(['channels', 'list']);
    const channels = parseJsonArray(output);
    return channels.map(parseChannel);
  }

  async createChannel(input: {
    name: string;
    description: string;
    type: 'stream' | 'forum';
    visibility: 'open' | 'private';
  }) {
    const output = await this.run([
      'channels',
      'create',
      '--name',
      input.name,
      '--description',
      input.description,
      '--type',
      input.type,
      '--visibility',
      input.visibility,
    ]);
    const value = parseJsonObject(output);
    if (typeof value.channel_id !== 'string') {
      throw new Error('Buzz channel creation did not return channel_id');
    }
    return {
      channelId: value.channel_id,
      name: input.name,
      description: input.description,
    };
  }

  async getChannel(channelId: string) {
    const output = await this.run(['channels', 'get', '--channel', channelId]);
    return parseChannel(parseJsonObject(output));
  }

  async listMembers(channelId: string) {
    const output = await this.run(['channels', 'members', '--channel', channelId]);
    return parseJsonArray(output).map(value => {
      if (typeof value.pubkey !== 'string' || typeof value.role !== 'string') {
        throw new Error('Buzz returned an invalid channel member');
      }
      return { pubkey: value.pubkey, role: parseMemberRole(value.role) };
    });
  }

  async addMember(channelId: string, member: DesiredMember) {
    await this.run([
      'channels',
      'add-member',
      '--channel',
      channelId,
      '--pubkey',
      member.pubkey,
      '--role',
      member.role,
    ]);
  }

  async getCanvas(channelId: string) {
    const output = await this.run(['canvas', 'get', '--channel', channelId]);
    const normalized = output.replaceAll('\r\n', '\n').trimEnd();
    return normalized === 'null' ? null : `${normalized}\n`;
  }

  async setCanvas(channelId: string, content: string) {
    await this.run(['canvas', 'set', '--channel', channelId, '--content', '-'], content);
  }

  async archiveChannel(channelId: string) {
    await this.run(['channels', 'archive', '--channel', channelId]);
  }

  private async run(arguments_: string[], input?: string) {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(this.binary, arguments_, {
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        stdout += String(chunk);
      });
      child.stderr.on('data', chunk => {
        stderr += String(chunk);
      });
      child.on('error', reject);
      child.on('close', code => {
        if (code === 0) {
          resolve(stdout);
          return;
        }
        reject(
          new Error(`Buzz command failed (${code ?? 'signal'}): ${stderr.trim() || stdout.trim()}`),
        );
      });
      child.stdin.end(input);
    });
  }
}

function parseChannel(value: Record<string, unknown>) {
  if (typeof value.channel_id !== 'string' || typeof value.name !== 'string') {
    throw new Error('Buzz returned an invalid channel');
  }
  return {
    channelId: value.channel_id,
    name: value.name,
    description: typeof value.description === 'string' ? value.description : '',
  };
}

function parseJsonArray(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('Buzz command did not return a JSON array');
  }
  return parsed.map(asRecord);
}

function parseJsonObject(value: string) {
  return asRecord(JSON.parse(value));
}

function asRecord(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Buzz command returned invalid JSON');
  }
  return value as Record<string, unknown>;
}
