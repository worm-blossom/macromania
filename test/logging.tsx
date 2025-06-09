import {
  Context,
  Expression,
  Children,
} from "macromaniajsx/jsx-dev-runtime";
import { LoggingBackend, LogLevel } from "../loggingBackend.ts";
import { assertEquals } from "@std/assert/assert-equals";

class TestLogger implements LoggingBackend {
  ops: LoggingOp[];

  constructor() {
    this.ops = [];
  }
  // deno-lint-ignore no-explicit-any
  log(level: LogLevel, ...data: any[]): void {
    this.ops.push([level, data]);
  }

  startGroup(): void {
    this.ops.push("startGroup");
  }

  endGroup(): void {
    this.ops.push("endGroup");
  }

  bgBlack(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgBlue(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgBrightBlack(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgBrightBlue(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgBrightCyan(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgBrightGreen(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgBrightMagenta(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgBrightRed(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgBrightWhite(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgBrightYellow(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgCyan(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgGreen(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgMagenta(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgRed(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgWhite(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bgYellow(_s: string): string {
    throw new Error("Method not implemented.");
  }
  black(_s: string): string {
    throw new Error("Method not implemented.");
  }
  blue(_s: string): string {
    throw new Error("Method not implemented.");
  }
  bold(_s: string): string {
    throw new Error("Method not implemented.");
  }
  brightBlack(_s: string): string {
    throw new Error("Method not implemented.");
  }
  brightBlue(_s: string): string {
    throw new Error("Method not implemented.");
  }
  brightCyan(_s: string): string {
    throw new Error("Method not implemented.");
  }
  brightGreen(_s: string): string {
    throw new Error("Method not implemented.");
  }
  brightMagenta(_s: string): string {
    throw new Error("Method not implemented.");
  }
  brightRed(_s: string): string {
    throw new Error("Method not implemented.");
  }
  brightWhite(_s: string): string {
    throw new Error("Method not implemented.");
  }
  brightYellow(_s: string): string {
    throw new Error("Method not implemented.");
  }
  cyan(_s: string): string {
    throw new Error("Method not implemented.");
  }
  dim(_s: string): string {
    throw new Error("Method not implemented.");
  }
  grey(_s: string): string {
    throw new Error("Method not implemented.");
  }
  green(_s: string): string {
    throw new Error("Method not implemented.");
  }
  italic(_s: string): string {
    throw new Error("Method not implemented.");
  }
  magenta(_s: string): string {
    throw new Error("Method not implemented.");
  }
  red(_s: string): string {
    throw new Error("Method not implemented.");
  }
  strikethrough(_s: string): string {
    throw new Error("Method not implemented.");
  }
  underline(_s: string): string {
    throw new Error("Method not implemented.");
  }
  white(_s: string): string {
    throw new Error("Method not implemented.");
  }
  yellow(_s: string): string {
    throw new Error("Method not implemented.");
  }

  opsToString(): string {
    return JSON.stringify(this.ops, undefined, 2);
  }

  assertEquals(other: TestLogger) {
    assertEquals(
      this.opsToString(),
      other.opsToString(),
    );
  }
}

// deno-lint-ignore no-explicit-any
type LoggingOp = [LogLevel, any[]] | "startGroup" | "endGroup";

Deno.test("logging basic", async () => {
  const logger = new TestLogger();
  const ctrl = new TestLogger();

  const ctx = new Context(logger);
  const got = await ctx.evaluate(
    <>
      <loggingLevel level="debug">
        <debug>a</debug>
        <loggingGroup>
          <trace>b</trace>
          <loggingGroup>
            <info>c</info>
          </loggingGroup>
          <warn>d</warn>
        </loggingGroup>
        <error>e</error>
      </loggingLevel>
    </>,
  );

  assertEquals(got, "");

  ctrl.log("debug", "a");
  ctrl.startGroup();
  ctrl.log("trace", "b");
  ctrl.startGroup();
  ctrl.log("info", "c");
  ctrl.endGroup();
  ctrl.log("warn", "d");
  ctrl.endGroup();
  ctrl.log("error", "e");
  logger.assertEquals(ctrl);
});

Deno.test("logging default level is info", async () => {
  const logger = new TestLogger();
  const ctrl = new TestLogger();

  const ctx = new Context(logger);
  const _got = await ctx.evaluate(
    <>
      <debug>a</debug>
      <loggingGroup>
        <trace>b</trace>
        <loggingGroup>
          <info>c</info>
        </loggingGroup>
        <warn>d</warn>
      </loggingGroup>
      <error>e</error>
    </>,
  );

  ctrl.startGroup();
  ctrl.startGroup();
  ctrl.log("info", "c");
  ctrl.endGroup();
  ctrl.log("warn", "d");
  ctrl.endGroup();
  ctrl.log("error", "e");
  logger.assertEquals(ctrl);
});

Deno.test("logging global levels", async () => {
  const logger = new TestLogger();
  const ctrl = new TestLogger();

  const ctx = new Context(logger);
  const _got = await ctx.evaluate(
    <>
      <loggingLevel level="debug">
        <info>a</info>
        <loggingLevel level="warn">
          <info>b</info>
          <loggingLevel level="error">
            <info>c</info>
          </loggingLevel>
          <loggingLevel level="info">
            <info>d</info>
          </loggingLevel>
          <info>e</info>
        </loggingLevel>
        <info>f</info>
      </loggingLevel>
    </>,
  );

  ctrl.log("info", "a");
  ctrl.log("info", "d");
  ctrl.log("info", "f");
  logger.assertEquals(ctrl);
});

Deno.test("logging macro-specific levels isolated regression 1", async () => {
  const logger = new TestLogger();
  const ctrl = new TestLogger();

  let counter = -1;

  function Count(): Expression {
    return (
      <effect
        fun={(_) => {
          counter += 1;
          return `${counter}`;
        }}
      />
    );
  }

  function A({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          At<Count />
        </trace>
        <warn>
          Aw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function B({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          Bt<Count />
        </trace>
        <warn>
          Bw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function C(): Expression {
    return (
      <>
        <trace>
          Ct<Count />
        </trace>
        <warn>
          Cw<Count />
        </warn>
        <A></A>
        <B></B>
        <A>
          <B></B>
        </A>
        <B>
          <A></A>
        </B>
      </>
    );
  }

  const ctx = new Context(logger);
  const _got = await ctx.evaluate(
    <>
      <loggingLevel level="debug">
        <C />
      </loggingLevel>
    </>,
  );

  ctrl.log("trace", "Ct0");
  ctrl.log("warn", "Cw1");

  // <A></A>
  ctrl.log("trace", "At2");
  ctrl.log("warn", "Aw3");
  // <B></B>
  ctrl.log("trace", "Bt4");
  ctrl.log("warn", "Bw5");

  // <A><B></B></A>
  ctrl.log("trace", "At6");
  ctrl.log("warn", "Aw7");
  ctrl.log("trace", "Bt8");
  ctrl.log("warn", "Bw9");

  // <B><A></A></B>
  ctrl.log("trace", "Bt10");
  ctrl.log("warn", "Bw11");
  ctrl.log("trace", "At12");
  ctrl.log("warn", "Aw13");

  logger.assertEquals(ctrl);

  //   console.log(logger.opsToString());
});

Deno.test("logging macro-specific levels isolated regression 2", async () => {
  const logger = new TestLogger();
  const ctrl = new TestLogger();

  let counter = -1;

  function Count(): Expression {
    return (
      <effect
        fun={(_) => {
          counter += 1;
          return `${counter}`;
        }}
      />
    );
  }

  function A({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          At<Count />
        </trace>
        <warn>
          Aw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function B({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          Bt<Count />
        </trace>
        <warn>
          Bw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function C(): Expression {
    return (
      <>
        <trace>
          Ct<Count />
        </trace>
        <warn>
          Cw<Count />
        </warn>
        <A></A>
        <B></B>
        <A>
          <B></B>
        </A>
        <B>
          <A></A>
        </B>
      </>
    );
  }

  const ctx = new Context(logger);
  const _got = await ctx.evaluate(
    <>
      <loggingLevel level="debug">
        <loggingLevel level="info" macro={A}>
          <C />
        </loggingLevel>
      </loggingLevel>
    </>,
  );

  ctrl.log("trace", "Ct0");
  ctrl.log("warn", "Cw1");

  // <A></A>
  ctrl.log("trace", "At2");
  ctrl.log("warn", "Aw3");
  // <B></B>
  ctrl.log("trace", "Bt4");
  ctrl.log("warn", "Bw5");

  // <A><B></B></A>
  ctrl.log("trace", "At6");
  ctrl.log("warn", "Aw7");
  ctrl.log("trace", "Bt8");
  ctrl.log("warn", "Bw9");

  // <B><A></A></B>
  ctrl.log("trace", "Bt10");
  ctrl.log("warn", "Bw11");
  ctrl.log("trace", "At12");
  ctrl.log("warn", "Aw13");

  logger.assertEquals(ctrl);

  //   console.log(logger.opsToString());
});

Deno.test("logging macro-specific levels isolated regression 3", async () => {
  const logger = new TestLogger();
  const ctrl = new TestLogger();

  let counter = -1;

  function Count(): Expression {
    return (
      <effect
        fun={(_) => {
          counter += 1;
          return `${counter}`;
        }}
      />
    );
  }

  function A({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          At<Count />
        </trace>
        <warn>
          Aw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function B({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          Bt<Count />
        </trace>
        <warn>
          Bw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function C(): Expression {
    return (
      <>
        <trace>
          Ct<Count />
        </trace>
        <warn>
          Cw<Count />
        </warn>
        <A></A>
        <B></B>
        <A>
          <B></B>
        </A>
        <B>
          <A></A>
        </B>
      </>
    );
  }

  const ctx = new Context(logger);
  const _got = await ctx.evaluate(
    <>
      <loggingLevel level="debug">
        <loggingLevel level="info" macro={C}>
          <C />
        </loggingLevel>
      </loggingLevel>
    </>,
  );

  //   ctrl.log("trace", "Ct0");
  ctrl.log("warn", "Cw1");

  // <A></A>
  //   ctrl.log("trace", "At2");
  ctrl.log("warn", "Aw3");
  // <B></B>
  //   ctrl.log("trace", "Bt4");
  ctrl.log("warn", "Bw5");

  // <A><B></B></A>
  //   ctrl.log("trace", "At6");
  ctrl.log("warn", "Aw7");
  //   ctrl.log("trace", "Bt8");
  ctrl.log("warn", "Bw9");

  // <B><A></A></B>
  //   ctrl.log("trace", "Bt10");
  ctrl.log("warn", "Bw11");
  //   ctrl.log("trace", "At12");
  ctrl.log("warn", "Aw13");

  logger.assertEquals(ctrl);

  //   console.log(logger.opsToString());
});

Deno.test("logging macro-specific levels isolated regression 4", async () => {
  const logger = new TestLogger();
  const ctrl = new TestLogger();

  let counter = -1;

  function Count(): Expression {
    return (
      <effect
        fun={(_) => {
          counter += 1;
          return `${counter}`;
        }}
      />
    );
  }

  function A({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          At<Count />
        </trace>
        <warn>
          Aw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function B({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          Bt<Count />
        </trace>
        <warn>
          Bw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function C(): Expression {
    return (
      <>
        <trace>
          Ct<Count />
        </trace>
        <warn>
          Cw<Count />
        </warn>
        <A></A>
        <B></B>
        <A>
          <B></B>
        </A>
        <B>
          <A></A>
        </B>
      </>
    );
  }

  const ctx = new Context(logger);
  const _got = await ctx.evaluate(
    <>
      <loggingLevel level="debug">
        <loggingLevel level="error" macro={A}>
          <loggingLevel level="info" macro={C}>
            <C />
          </loggingLevel>
        </loggingLevel>
      </loggingLevel>
    </>,
  );

  //   ctrl.log("trace", "Ct0");
  ctrl.log("warn", "Cw1");

  // <A></A>
  //   ctrl.log("trace", "At2");
  ctrl.log("warn", "Aw3");
  // <B></B>
  //   ctrl.log("trace", "Bt4");
  ctrl.log("warn", "Bw5");

  // <A><B></B></A>
  //   ctrl.log("trace", "At6");
  ctrl.log("warn", "Aw7");
  //   ctrl.log("trace", "Bt8");
  ctrl.log("warn", "Bw9");

  // <B><A></A></B>
  //   ctrl.log("trace", "Bt10");
  ctrl.log("warn", "Bw11");
  //   ctrl.log("trace", "At12");
  ctrl.log("warn", "Aw13");

  logger.assertEquals(ctrl);

  //   console.log(logger.opsToString());
});

Deno.test("logging macro-specific levels isolated regression 5", async () => {
  const logger = new TestLogger();
  const ctrl = new TestLogger();

  let counter = -1;

  function Count(): Expression {
    return (
      <effect
        fun={(_) => {
          counter += 1;
          return `${counter}`;
        }}
      />
    );
  }

  function A({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          At<Count />
        </trace>
        <warn>
          Aw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function B({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          Bt<Count />
        </trace>
        <warn>
          Bw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function C(): Expression {
    return (
      <>
        <trace>
          Ct<Count />
        </trace>
        <warn>
          Cw<Count />
        </warn>
        <A></A>
        <B></B>
        <A>
          <B></B>
        </A>
        <B>
          <A></A>
        </B>
      </>
    );
  }

  const ctx = new Context(logger);
  const _got = await ctx.evaluate(
    <>
      <loggingLevel level="debug">
        <loggingLevel level="info" macro={C}>
          <loggingLevel level="debug" macro={A}>
            <C />
          </loggingLevel>
        </loggingLevel>
      </loggingLevel>
    </>,
  );

  //   ctrl.log("trace", "Ct0");
  ctrl.log("warn", "Cw1");

  // <A></A>
  //   ctrl.log("trace", "At2");
  ctrl.log("warn", "Aw3");
  // <B></B>
  //   ctrl.log("trace", "Bt4");
  ctrl.log("warn", "Bw5");

  // <A><B></B></A>
  //   ctrl.log("trace", "At6");
  ctrl.log("warn", "Aw7");
  //   ctrl.log("trace", "Bt8");
  ctrl.log("warn", "Bw9");

  // <B><A></A></B>
  //   ctrl.log("trace", "Bt10");
  ctrl.log("warn", "Bw11");
  //   ctrl.log("trace", "At12");
  ctrl.log("warn", "Aw13");

  logger.assertEquals(ctrl);

  //   console.log(logger.opsToString());
});

Deno.test("logging macro-specific levels", async () => {
  const logger = new TestLogger();
  const ctrl = new TestLogger();

  let counter = -1;

  function Count(): Expression {
    return (
      <effect
        fun={(_) => {
          counter += 1;
          return `${counter}`;
        }}
      />
    );
  }

  function A({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          At<Count />
        </trace>
        <warn>
          Aw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function B({ children }: { children?: Children }): Expression {
    return (
      <>
        <trace>
          Bt<Count />
        </trace>
        <warn>
          Bw<Count />
        </warn>
        <>{children}</>
      </>
    );
  }

  function C(): Expression {
    return (
      <>
        <trace>
          Ct<Count />
        </trace>
        <warn>
          Cw<Count />
        </warn>
        <A></A>
        <B></B>
        <A>
          <B></B>
        </A>
        <B>
          <A></A>
        </B>
      </>
    );
  }

  const ctx = new Context(logger);
  const _got = await ctx.evaluate(
    <>
      <loggingLevel level="debug">
        <trace>
          <Count />
        </trace>
        <warn>
          <Count />
        </warn>
        <A></A>
        <B></B>
        <loggingLevel level="info" macro={A}>
          <trace>
            <Count />
          </trace>
          <warn>
            <Count />
          </warn>
          <A></A>
          <B></B>
          <loggingLevel level="error" macro={A}>
            <trace>
              <Count />
            </trace>
            <warn>
              <Count />
            </warn>
            <A></A>
            <B></B>
          </loggingLevel>
          <trace>
            <Count />
          </trace>
          <warn>
            <Count />
          </warn>
          <A></A>
          <B></B>
          <A>
            <B></B>
          </A>
          <B>
            <A></A>
          </B>

          <C />
        </loggingLevel>
      </loggingLevel>
    </>,
  );

  ctrl.log("trace", "0");
  ctrl.log("warn", "1");
  ctrl.log("trace", "At2");
  ctrl.log("warn", "Aw3");
  ctrl.log("trace", "Bt4");
  ctrl.log("warn", "Bw5");

  ctrl.log("trace", "6");
  ctrl.log("warn", "7");
  ctrl.log("warn", "Aw9");
  ctrl.log("trace", "Bt10");
  ctrl.log("warn", "Bw11");

  ctrl.log("trace", "12");
  ctrl.log("warn", "13");
  ctrl.log("trace", "Bt16");
  ctrl.log("warn", "Bw17");

  ctrl.log("trace", "18");
  ctrl.log("warn", "19");
  ctrl.log("warn", "Aw21");
  ctrl.log("trace", "Bt22");
  ctrl.log("warn", "Bw23");

  // A in B
  ctrl.log("warn", "Aw25");
  ctrl.log("trace", "Bt26");
  ctrl.log("warn", "Bw27");

  // B in A
  ctrl.log("trace", "Bt28");
  ctrl.log("warn", "Bw29");
  ctrl.log("warn", "Aw31");

  // C
  ctrl.log("trace", "Ct32");
  ctrl.log("warn", "Cw33");
  ctrl.log("trace", "At34");
  ctrl.log("warn", "Aw35");
  ctrl.log("trace", "Bt36");
  ctrl.log("warn", "Bw37");
  ctrl.log("trace", "At38");
  ctrl.log("warn", "Aw39");
  ctrl.log("trace", "Bt40");
  ctrl.log("warn", "Bw41");
  ctrl.log("trace", "Bt42");
  ctrl.log("warn", "Bw43");
  ctrl.log("trace", "At44");
  ctrl.log("warn", "Aw45");

  logger.assertEquals(ctrl);

  // console.log(logger.opsToString());
});
