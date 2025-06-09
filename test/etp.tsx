/*
Tests for EvaluationTreePositions (ETPs).
*/

import { assert } from "@std/assert";
import { type Children, Context, type Expression } from "../mod.ts";
import type { EvaluationTreePosition } from "../evaluationTreePosition.ts";

type EtpPointer = { ptr?: EvaluationTreePosition };

Deno.test("etp simple", async () => {
  function A({ children }: { children?: Children }): Expression {
    return <>{children}</>;
  }

  function SaveEtp(
    { children, ptr }: { children?: Children; ptr: EtpPointer },
  ): Expression {
    return (
      <effect
        fun={(ctx: Context) => {
          ptr.ptr = ctx.getEvaluationTreePosition();
          return <>{children}</>;
        }}
      />
    );
  }

  const parent: EtpPointer = {};
  const child1: EtpPointer = {};
  const child2: EtpPointer = {};
  const grandchild1_1: EtpPointer = {};
  const grandchild1_2: EtpPointer = {};
  const grandchild2_1: EtpPointer = {};
  const grandchild2_2: EtpPointer = {};

  const ctx = new Context();
  const _got = await ctx.evaluate(
    <SaveEtp ptr={parent}>
      <A>
        <SaveEtp ptr={child1}>
          <SaveEtp ptr={grandchild1_1}></SaveEtp>
          <SaveEtp ptr={grandchild1_2}></SaveEtp>
        </SaveEtp>
      </A>
      <SaveEtp ptr={child2}>
        <A>
          <SaveEtp ptr={grandchild2_1}></SaveEtp>
          <SaveEtp ptr={grandchild2_2}></SaveEtp>
        </A>
      </SaveEtp>
    </SaveEtp>,
  );

  assert(parent.ptr!.equals(parent.ptr!));
  assert(parent.ptr!.isAncestorOf(parent.ptr!));
  assert(parent.ptr!.isDescendantOf(parent.ptr!));
  assert(parent.ptr!.isEarlierThan(parent.ptr!));
  assert(parent.ptr!.isLaterThan(parent.ptr!));
  assert(!parent.ptr!.isStrictAncestorOf(parent.ptr!));
  assert(!parent.ptr!.isStrictDescendantOf(parent.ptr!));
  assert(!parent.ptr!.isStrictlyEarlierThan(parent.ptr!));
  assert(!parent.ptr!.isStrictlyLaterThan(parent.ptr!));

  assert(parent.ptr!.isStrictAncestorOf(child1.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(grandchild1_1.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(grandchild1_2.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(child2.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(grandchild2_1.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(grandchild2_2.ptr!));
  assert(parent.ptr!.isStrictlyEarlierThan(child1.ptr!));
  assert(parent.ptr!.isStrictlyEarlierThan(grandchild1_1.ptr!));
  assert(parent.ptr!.isStrictlyEarlierThan(grandchild1_2.ptr!));
  assert(parent.ptr!.isStrictlyEarlierThan(child2.ptr!));
  assert(parent.ptr!.isStrictlyEarlierThan(grandchild2_1.ptr!));
  assert(parent.ptr!.isStrictlyEarlierThan(grandchild2_2.ptr!));

  assert(child1.ptr!.isStrictDescendantOf(parent.ptr!));
  assert(child1.ptr!.isStrictAncestorOf(grandchild1_1.ptr!));
  assert(child1.ptr!.isStrictAncestorOf(grandchild1_2.ptr!));
  assert(!child1.ptr!.isAncestorOf(child2.ptr!));
  assert(!child1.ptr!.isAncestorOf(grandchild2_1.ptr!));
  assert(!child1.ptr!.isAncestorOf(grandchild2_2.ptr!));
  assert(child1.ptr!.isStrictlyLaterThan(parent.ptr!));
  assert(child1.ptr!.isStrictlyEarlierThan(grandchild1_1.ptr!));
  assert(child1.ptr!.isStrictlyEarlierThan(grandchild1_2.ptr!));
  assert(child1.ptr!.isStrictlyEarlierThan(child2.ptr!));
  assert(child1.ptr!.isStrictlyEarlierThan(grandchild2_1.ptr!));
  assert(child1.ptr!.isStrictlyEarlierThan(grandchild2_2.ptr!));

  assert(grandchild1_1.ptr!.isStrictDescendantOf(parent.ptr!));
  assert(grandchild1_1.ptr!.isStrictDescendantOf(child1.ptr!));
  assert(!grandchild1_1.ptr!.isAncestorOf(grandchild1_2.ptr!));
  assert(!grandchild1_1.ptr!.isAncestorOf(child2.ptr!));
  assert(!grandchild1_1.ptr!.isAncestorOf(grandchild2_1.ptr!));
  assert(!grandchild1_1.ptr!.isAncestorOf(grandchild2_2.ptr!));
  assert(grandchild1_1.ptr!.isStrictlyLaterThan(parent.ptr!));
  assert(grandchild1_1.ptr!.isStrictlyLaterThan(child1.ptr!));
  assert(grandchild1_1.ptr!.isStrictlyEarlierThan(grandchild1_2.ptr!));
  assert(grandchild1_1.ptr!.isStrictlyEarlierThan(child2.ptr!));
  assert(grandchild1_1.ptr!.isStrictlyEarlierThan(grandchild2_1.ptr!));
  assert(grandchild1_1.ptr!.isStrictlyEarlierThan(grandchild2_2.ptr!));

  assert(grandchild1_1.ptr!.isStrictDescendantOf(parent.ptr!));
  assert(!grandchild1_2.ptr!.isAncestorOf(child1.ptr!));
  assert(!grandchild1_2.ptr!.isAncestorOf(grandchild1_1.ptr!));
  assert(!grandchild1_2.ptr!.isAncestorOf(child2.ptr!));
  assert(!grandchild1_2.ptr!.isAncestorOf(grandchild2_1.ptr!));
  assert(!grandchild1_2.ptr!.isAncestorOf(grandchild2_2.ptr!));
  assert(grandchild1_2.ptr!.isStrictlyLaterThan(parent.ptr!));
  assert(grandchild1_2.ptr!.isStrictlyLaterThan(child1.ptr!));
  assert(grandchild1_2.ptr!.isStrictlyLaterThan(grandchild1_1.ptr!));
  assert(grandchild1_2.ptr!.isStrictlyEarlierThan(child2.ptr!));
  assert(grandchild1_2.ptr!.isStrictlyEarlierThan(grandchild2_1.ptr!));
  assert(grandchild1_2.ptr!.isStrictlyEarlierThan(grandchild2_2.ptr!));

  assert(child2.ptr!.isStrictDescendantOf(parent.ptr!));
  assert(!child2.ptr!.isAncestorOf(child1.ptr!));
  assert(!child2.ptr!.isAncestorOf(grandchild1_1.ptr!));
  assert(!child2.ptr!.isAncestorOf(grandchild1_2.ptr!));
  assert(child2.ptr!.isStrictAncestorOf(grandchild2_1.ptr!));
  assert(child2.ptr!.isStrictAncestorOf(grandchild2_2.ptr!));
  assert(child2.ptr!.isStrictlyLaterThan(parent.ptr!));
  assert(child2.ptr!.isStrictlyLaterThan(child1.ptr!));
  assert(child2.ptr!.isStrictlyLaterThan(grandchild1_1.ptr!));
  assert(child2.ptr!.isStrictlyLaterThan(grandchild1_2.ptr!));
  assert(child2.ptr!.isStrictlyEarlierThan(grandchild2_1.ptr!));
  assert(child2.ptr!.isStrictlyEarlierThan(grandchild2_2.ptr!));
});

Deno.test("etp delayed", async () => {
  function SaveEtp(
    { children, ptr }: { children?: Children; ptr: EtpPointer },
  ): Expression {
    return (
      <effect
        fun={(ctx: Context) => {
          ptr.ptr = ctx.getEvaluationTreePosition();
          return <>{children}</>;
        }}
      />
    );
  }

  const parent: EtpPointer = {};
  const child1: EtpPointer = {};
  const child2: EtpPointer = {};
  const child3: EtpPointer = {};

  const ctx = new Context();
  const _got = await ctx.evaluate(
    <SaveEtp ptr={parent}>
      <SaveEtp ptr={child1}></SaveEtp>
      <effect
        fun={(ctx) => {
          if (ctx.mustMakeProgress()) {
            return <SaveEtp ptr={child2}></SaveEtp>;
          } else {
            return null;
          }
        }}
      />
      <SaveEtp ptr={child3}></SaveEtp>
    </SaveEtp>,
  );

  assert(parent.ptr!.isStrictAncestorOf(child1.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(child2.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(child3.ptr!));

  assert(child2.ptr!.isStrictlyLaterThan(parent.ptr!));
  assert(child2.ptr!.isStrictlyLaterThan(child1.ptr!));
  assert(child2.ptr!.isStrictlyEarlierThan(child3.ptr!));
});

Deno.test("etp map", async () => {
  function SaveEtp(
    { children, ptr }: { children?: Children; ptr: EtpPointer },
  ): Expression {
    return (
      <effect
        fun={(ctx: Context) => {
          ptr.ptr = ctx.getEvaluationTreePosition();
          return <>{children}</>;
        }}
      />
    );
  }

  const parent: EtpPointer = {};
  const child1: EtpPointer = {};
  const child2a: EtpPointer = {};
  const child2b: EtpPointer = {};
  const child3: EtpPointer = {};

  const ctx = new Context();
  const _got = await ctx.evaluate(
    <SaveEtp ptr={parent}>
      <SaveEtp ptr={child1}></SaveEtp>
      <map
        fun={(_ctx, _) => {
          return <SaveEtp ptr={child2a}></SaveEtp>;
        }}
      >
        <SaveEtp ptr={child2b}></SaveEtp>
      </map>
      <SaveEtp ptr={child3}></SaveEtp>
    </SaveEtp>,
  );

  assert(parent.ptr!.isStrictAncestorOf(child1.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(child2a.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(child2b.ptr!));
  assert(parent.ptr!.isStrictAncestorOf(child3.ptr!));

  assert(child2a.ptr!.isStrictlyLaterThan(parent.ptr!));
  assert(child2a.ptr!.isStrictlyLaterThan(child1.ptr!));
  assert(child2a.ptr!.isStrictlyEarlierThan(child2b.ptr!));
  assert(child2a.ptr!.isStrictlyEarlierThan(child3.ptr!));

  assert(child2b.ptr!.isStrictlyLaterThan(parent.ptr!));
  assert(child2b.ptr!.isStrictlyLaterThan(child1.ptr!));
  assert(child2b.ptr!.isStrictlyLaterThan(child2a.ptr!));
  assert(child2b.ptr!.isStrictlyEarlierThan(child3.ptr!));
});
