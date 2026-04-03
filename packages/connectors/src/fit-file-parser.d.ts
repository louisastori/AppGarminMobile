declare module "fit-file-parser" {
  interface FitParserOptions {
    force?: boolean;
    mode?: string;
    speedUnit?: string;
    lengthUnit?: string;
    temperatureUnit?: string;
    elapsedRecordField?: boolean;
  }

  type FitParseCallback = (error: Error | null, data: unknown) => void;

  export default class FitParser {
    constructor(options?: FitParserOptions);
    parse(content: Buffer, callback: FitParseCallback): void;
  }
}
