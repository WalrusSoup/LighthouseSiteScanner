/* eslint-disable */
import { parse } from 'ts-command-line-args';

interface CommandLineArguments{
  url: string;
  exclude: any;
}

export const args = parse<CommandLineArguments>(
  {
    url: { type: String },
    exclude: { type: String, multiple: true, optional: true }
  }
)