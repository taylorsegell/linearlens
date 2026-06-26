import * as path from "node:path";

export interface UriLike {
  fsPath: string;
  path: string;
}

export const Uri = {
  joinPath(base: UriLike, ...parts: string[]): UriLike {
    const joined = path.join(base.fsPath, ...parts);
    return { fsPath: joined, path: joined.replace(/\\/g, "/") };
  },
};

export class Disposable {
  dispose(): void {}
}

export namespace Disposable {
  export function from(...disposables: Disposable[]): Disposable {
    return {
      dispose() {
        for (const d of disposables) {
          d.dispose();
        }
      },
    };
  }
}
