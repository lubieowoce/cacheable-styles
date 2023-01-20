/* eslint-disable @typescript-eslint/no-use-before-define */
import { v4 as uuid } from "uuid";
import merge from "deepmerge";
import {
  css as createEmotionClassname,
  CSSInterpolation,
  CSSObject
} from "@emotion/css";
import hashString from "@emotion/hash";
import { useStyleCache } from "./cache";
import React from "react";

type CSS = CSSObject;

//==================
// Abstract style
//==================

type CacheKey = string;

/**
 * An abstract representation of a combination of styles,
 * designed to be as cacheable as possible.
 *
 * TODO: figure out if we can hide implemetation details more.
 * Maybe even make it a class?
 */
export type AbstractStyle =
  | null
  | AbstractStyleStatic
  | AbstractStyleMerge
  | AbstractStyleDynamicObj
  | AbstractStyleDynamicFn<any>;

type AbstractStyleStatic = { type: "static"; key: CacheKey; css: CSS };

type AbstractStyleMerge = {
  type: "merge";
  key: CacheKey;
  left: AbstractStyle;
  right: AbstractStyle;
};

type AbstractStyleDynamicObj = { type: "dynamic-obj"; key: CacheKey; css: CSS };

export type AbstractStyleDynamicFn<TProps> = {
  type: "dynamic-fn";
  key: CacheKey;
  props: TProps;
  fn: StyleFn<TProps>;
};

type StyleFn<TProps> = (props: TProps) => CSS;

const NULL_STYLE_KEY: CacheKey = "0";

/** No style. */
export const nullStyle: AbstractStyle = null;

/** A static piece of CSS, known ahead of time. */
export const createStyle = (css: CSS): AbstractStyleStatic => {
  // TODO profile if the hash makes sense.
  // the cache key will be smaller, but hashing isn't free.
  const key = hashString(JSON.stringify(css));
  return {
    type: "static",
    key,
    css
  };
};

/** A style that depends on runtime inputs.
 * Worth using if you've got a bunch of styles depending on a small number of props --
 * it's faster to hash only the inputs instead of the whole style object.
 **/
export function createDynamicStyle<TProps>(
  fn: StyleFn<TProps>
): (props: TProps) => AbstractStyleDynamicFn<TProps> {
  // TODO: cache hydration?
  // if we do cache hydration, this won't hydrate
  // cleanly, because the GUID will be different.
  // should we allow passing a (hopefully) unique string?
  // TODO: this hash is prob unnecessary, but we only run it once
  // and it makes the cache keys smaller & nicer to look at :)
  const keyBase = hashString(uuid());

  return (props) => {
    const propsKey = typeof props === "string" ? props : JSON.stringify(props);
    const key = keyBase + "(" + propsKey + ")";
    return {
      type: "dynamic-fn",
      key,
      props,
      fn: fn as StyleFn<unknown>
    };
  };
}

/** A dynamic style, known only at runtime.
 * Cached by a full JSON.stringify.
 */
export const dynamicStyle = (css: CSS): AbstractStyleDynamicObj => {
  // technically the createStyle, but we're not hashing this one
  const key = JSON.stringify(css);
  return {
    type: "dynamic-obj",
    key,
    css
  };
};

export const isNullStyle = (style: AbstractStyle): style is null => {
  return !style;
};

/** A combination of two styles.
 * Will end up deepMerged together.
 * */
export const mergeStyles = (
  left: AbstractStyle,
  right: AbstractStyle
): AbstractStyle => {
  // merging with nullStyle is a no-op,
  // so just return the other arg
  if (isNullStyle(left)) {
    return right || nullStyle;
  }
  if (isNullStyle(right)) {
    return left || nullStyle;
  }
  const leftKey = left.key;
  const rightKey = right.key;
  if (leftKey === rightKey) {
    return left;
  }
  // Compute a merged key.
  const key = leftKey + " " + rightKey;
  // NOTE:
  // We don't want brackets "[" + ... + "]" around the key.
  // our merge operation is associative, i.e. these two are the same:
  //
  //   merge(a, merge(b, c)) == merge(merge(a, b), c)
  //
  // so we want their cache keys to be the same as well:
  //
  //   ("a" + " " + "b") + " " + "c" ==
  //    "a" + " " + ("b" + " " + "c") ==
  //    "a b c"
  //
  // note that this also the case for responsive (array) props,
  // where `right` will override `left`.

  // Build the actual node

  if (right.type === "merge") {
    // Optimization:
    // it's nicer for us to have a left-biased tree of merges.
    // so if our inputs are
    //
    //      +         +
    //    /  \      /  \
    //   L1   L2   R1   R2
    //
    //  we wanna end up with
    //
    //             +
    //           /  \
    //          +   R2
    //        /   \
    //       +    R1
    //      /  \
    //     L1  L1
    //
    // because commonly, we're gonna be merging a big left and a small right.
    // (I HOPE!)
    // TODO: instead of tree shenanigans,
    // maybe it's better to have merge-nodes just contain an array?
    const { left: r1, right: r2 } = right;
    return mergeStyles(mergeStyles(left, r1), r2);
  }

  // final, default case
  // just build a node
  return { type: "merge", key, left, right };
};

const getKey = (style: AbstractStyle): CacheKey => {
  return style ? style.key : NULL_STYLE_KEY;
};

//====================
// Style computation
// (actually merging all of it)
//====================

const computeStyles = (style: AbstractStyle): CSS | undefined => {
  if (isNullStyle(style)) {
    return undefined;
  }
  switch (style.type) {
    case "dynamic-obj":
    case "static": {
      return style.css;
    }
    case "merge": {
      const { left, right } = style;
      return mergeComputedStyles(computeStyles(left), computeStyles(right));
    }
    case "dynamic-fn": {
      return style.fn(style.props);
    }
  }
};

const mergeComputedStyles = (
  left: CSS | undefined,
  right: CSS | undefined
): CSS | undefined => {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return merge(left, right);
};

//======================
// useSystem - let's make all that CSS actually do something
//======================

const getCompoundKey = (__root: AbstractStyle, sx: AbstractStyle) => {
  return getKey(mergeStyles(__root, sx));
};

const __DEV__ = process.env.NODE_ENV === "development";

export const useStyles = (style: AbstractStyle): string => {
  return useSystem(null, style);
};

const useSystem = (__root: AbstractStyle, sx: AbstractStyle): string => {
  const cache = useStyleCache();
  const key = getCompoundKey(__root, sx);
  if (key === NULL_STYLE_KEY) {
    return "";
  }

  const existingClassNames = cache?.get(key);
  if (existingClassNames) {
    return existingClassNames;
  }

  const computedRoot = __root && computeStyles(__root);
  const computedSx = sx && computeStyles(sx);

  const classNames = createEmotionClassname([
    computedRoot as CSSInterpolation,
    computedSx as CSSInterpolation
  ]);

  if (__DEV__) {
    // debug logging
    const styleStr = JSON.stringify(
      { __root, sx },
      (_, v) => {
        if (typeof v === "function") {
          return `[Function ${v.name ?? "<anonymous>"}]`;
        }
        return v;
      },
      2
    );
    const computedStr = JSON.stringify([computedRoot, computedSx], null, 2);
    console.log(
      `computed classname "${classNames}" from:` +
        `\ncache key: ${JSON.stringify(key)}` +
        `\nsources: ${styleStr}` +
        `\ncomputed:\n${computedStr}`
    );
  }

  cache?.set(key, classNames);
  return classNames;
};

//==================
// Base
//==================

type BaseProps<AsT extends AsIntrinsic = "div"> = {
  as?: AsT;
  __root?: AbstractStyle;
  sx?: AbstractStyle;
  className?: string;
} & React.ComponentProps<AsT>;

type AsIntrinsic = keyof JSX.IntrinsicElements;

const DEFAULT_STYLES = createStyle({
  boxSizing: "border-box",
  margin: 0,
  minWidth: 0
});

const mergeClassNames = (
  cls1: string | undefined,
  cls2: string | undefined
): string | undefined => {
  if (!cls1) return cls2;
  if (!cls2) return cls1;
  return `${cls1} ${cls2}`;
};

export const Base = <AsT extends AsIntrinsic = "div">({
  as: asTag = "div" as any,
  className: userClassName,
  sx = null,
  __root = null,
  ...props
}: React.PropsWithChildren<BaseProps<AsT>>) => {
  const baseClassName = useSystem(DEFAULT_STYLES, null);
  const generatedClassNames = useSystem(__root, sx);
  const mergedClassName = mergeClassNames(
    baseClassName,
    mergeClassNames(generatedClassNames, userClassName)
  );
  const AsTag = asTag as any;
  return <AsTag className={mergedClassName} {...props} />;
};

// const a = createStyle({
//   marginLeft: "16px",
//   marginRight: "16px"
// });

// const b = createStyle({
//   backgroundColor: "blue",
//   color: "yellow"
// });

// console.log("a:", a);
// console.log("a:", b);

// const c = mergeStyles(a, b);

// console.log("a + b:", c);
