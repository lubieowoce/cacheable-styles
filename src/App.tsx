/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  createStyle,
  mergeStyles,
  createDynamicStyle,
  AbstractStyle,
  dynamicStyle,
  Base,
  useStyles
} from "./system";
import {
  createStyleCache,
  StyleCache,
  StyleCacheProvider,
  useStyleCache
} from "./cache";

import { v4 as uuid } from "uuid";
//======================
// Card
//======================

const cardStyles = {
  base: createStyle({
    border: "1px solid lightgray",
    padding: "1em",
    borderRadius: "8px"
  }),
  variants: {
    default: createStyle({
      backgroundColor: "white",
      borderColor: "lightgray",
      color: "black"
    }),
    inverted: createStyle({
      backgroundColor: "#333",
      borderColor: "darkgray",
      color: "white"
    })
  }
};

const Card = ({
  variant = "default",
  sx,
  children
}: React.PropsWithChildren<{
  variant?: "default" | "inverted";
  sx?: AbstractStyle;
}>) => {
  const styles = mergeStyles(cardStyles.base, cardStyles.variants[variant]);
  return (
    <Base as="article" __root={styles} sx={sx}>
      {children}
    </Base>
  );
};

//======================
// Stack
//======================

const spaceToken = {
  spaceS: "8px",
  spaceM: "16px",
  spaceL: "24px",
  spaceXl: "32px"
} as const;

type SpaceToken = keyof typeof spaceToken;

const stackStyles = {
  base: createStyle({ display: "flex" }),
  variants: {
    horizontal: createStyle({ flexDirection: "row" }),
    vertical: createStyle({ flexDirection: "column" })
  },
  spacing: createDynamicStyle<SpaceToken>((spacing) => ({
    gap: spaceToken[spacing]
  }))
};

const Stack = ({
  spacing = "spaceM",
  direction,
  sx,
  children
}: React.PropsWithChildren<{
  direction: "horizontal" | "vertical";
  spacing?: SpaceToken;
  sx?: AbstractStyle;
}>) => {
  const styles =
    // we could add more syntactic sugar here,
    // like `mergeStyles(one, two, three)`
    // but i'm leaving it as-is for illustrative purposes
    // (as in, this is what's gonna happen under the hood)
    mergeStyles(
      stackStyles.base,
      mergeStyles(
        stackStyles.variants[direction],
        stackStyles.spacing(spacing)
        // instead of stackStyles.spacing we could do
        // dynamicStyle({ gap: spaceToken[spacing] })
        // but this method should be more efficient
      )
    );
  return (
    <Base __root={styles} sx={sx}>
      {children}
    </Base>
  );
};

const FlexItem = ({
  flxFlex,
  flxItems,
  flxJustify,
  sx,
  children
}: React.PropsWithChildren<{
  sx?: AbstractStyle;
  flxFlex?: string;
  flxItems?: string;
  flxJustify?: string;
}>) => {
  const style = dynamicStyle({
    flex: flxFlex,
    flexItems: flxItems,
    justifyContent: flxJustify
  });
  return (
    <Base __root={style} sx={sx}>
      {children}
    </Base>
  );
};

//===================
// Dynamic cards
//===================

const DynamicCard = () => {
  const [color, setColor] = useState("#FFD296");
  const uid = useState(() => uuid())[0];
  const id = "dynamic-card-" + uid;
  return (
    <Card
      sx={
        // color is the only thing that varies,
        // we could use createDynamicStyle too,
        // but i'm lazy
        dynamicStyle({
          backgroundColor: color
        })
      }
    >
      <Stack direction="vertical">
        <label htmlFor={id}>Dynamic card! Pick a color:</label>
        <input
          id={id}
          value={color}
          type="color"
          onChange={(e) => setColor(e.target.value)}
        />
      </Stack>
    </Card>
  );
};

const ToggleCard = ({
  initialVariant,
  children
}: React.PropsWithChildren<{ initialVariant: "default" | "inverted" }>) => {
  const [variant, setVariant] = useState(initialVariant);
  const toggles = { default: "inverted", inverted: "default" } as const;
  const toggleVariant = () => setVariant((p) => toggles[p]);
  return (
    <Card variant={variant}>
      <Stack direction="horizontal">
        <FlexItem flxFlex="1 auto">{children}</FlexItem>
        <button onClick={toggleVariant}>Toggle variant</button>
      </Stack>
    </Card>
  );
};

const CardList = ({ initialCount = 0 }: { initialCount?: number }) => {
  const [count, setCount] = useState(initialCount);
  const onIncrement = () => setCount((c) => c + 1);
  const onDecrement = () => setCount((c) => Math.max(0, c - 1));
  return (
    <Stack direction="vertical">
      <Stack direction="horizontal" sx={dynamicStyle({ alignItems: "center" })}>
        Card list
        <button onClick={onIncrement}>add</button>
        <button onClick={onDecrement}>remove</button>
      </Stack>
      <Stack direction="vertical">
        {Array.from({ length: count }, (_, i) => (
          <ToggleCard initialVariant="default" key={`${i}`}>
            Card list card ({i + 1})
          </ToggleCard>
        ))}
        {count === 0 && (
          <Card
            sx={dynamicStyle({
              borderStyle: "dashed",
              borderWidth: "2px",
              color: "#aaa"
            })}
          >
            No cards here
          </Card>
        )}
      </Stack>
    </Stack>
  );
};

//======================
// App
//======================

export default function Root() {
  const styleCache = useMemo(() => createStyleCache(), []);
  useEffect(() => {
    // debug
    (window as any)["styleCache"] = styleCache;
    return () => {
      delete (window as any)["styleCache"];
    };
  }, [styleCache]);
  const [key, incrKey] = useReducer((c) => c + 1, 0);
  return (
    <StyleCacheProvider cache={styleCache}>
      <App key={`${key}`} onReset={incrKey} />
    </StyleCacheProvider>
  );
}

export function App({ onReset }: { onReset?: () => void }) {
  const [, forceRerender] = useReducer((c) => c + 1, 0);

  const resetBtn = <button onClick={onReset}>Reset</button>;
  const rerenderBtn = <button onClick={forceRerender}>Force rerender</button>;

  const [spacing, setSpacing] = useState<SpaceToken>("spaceM");
  const spacingPicker = (
    <label>
      Spacing{" "}
      <select
        value={spacing}
        onChange={(e) => setSpacing(e.target.value as any)}
      >
        {Object.keys(spaceToken).map((tok) => (
          <option key={tok} value={tok}>
            {tok}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Base
      sx={dynamicStyle({
        fontFamily: "sans-serif",
        margin: "0 auto",
        maxWidth: "500px"
      })}
    >
      <Base
        sx={dynamicStyle({
          position: "sticky",
          top: 0,
          padding: "0.5em",
          backgroundColor: "white",
          border: "1px solid lightgray",
          marginBottom: "1em"
        })}
      >
        <CacheStats />
      </Base>
      <Stack direction="vertical" spacing="spaceL">
        <Stack direction="horizontal">
          {spacingPicker}
          <FlexItem flxFlex="1 auto" />
          {rerenderBtn}
          {resetBtn}
        </Stack>
        <Stack
          direction="vertical"
          spacing={spacing}
          sx={dynamicStyle({
            padding: "0.5em",
            backgroundColor: "#f1f1f1",
            "&:before": {
              content: `"I'm a customized Stack. I've got spacing='${spacing}', a gray background, and this text is a ::before!"`,
              fontSize: "0.8em",
              color: "darkgray"
            }
          })}
        >
          <Card>Hello default card!</Card>
          <ToggleCard initialVariant="inverted">
            Hello inverted card!
          </ToggleCard>
          <Card
            sx={dynamicStyle({
              backgroundColor: "rgb(255, 150, 210)",
              fontStyle: "italic"
            })}
          >
            Hello Card with sx!
          </Card>
          <DynamicCard />
        </Stack>
        <Card>
          <CardList />
        </Card>
        <SelfRuleTest />
      </Stack>
    </Base>
  );
}

const itemRoot = createStyle({
  border: "1px solid lightgrey",
  padding: "0.5em",
  "& + &": { marginTop: "1em" }
});

const itemCustom = createStyle({
  backgroundColor: "rgb(255, 230, 230)",
  "& + &": { borderTop: "2px solid red" }
});

const SelfRuleTest = () => {
  const itemCustomCls = useStyles(itemCustom);
  return (
    <Card>
      <Base sx={dynamicStyle({ marginBottom: "0.5em" })}>&amp;-rule test</Base>
      <Base>
        <Base __root={itemRoot}>Item</Base>
        <Base __root={itemRoot} className={itemCustomCls} /*sx={itemCustom}*/>
          Item
        </Base>
        <Base __root={itemRoot} className={itemCustomCls} /*sx={itemCustom}*/>
          Item
        </Base>
        <Base __root={itemRoot}>Item</Base>
      </Base>
    </Card>
  );
};

//===================
// Cache stats
//===================

const CacheStats = () => {
  const statsDivRef = useRef<HTMLDivElement | null>(null);
  const lastWrittenRef = useRef<string | null>(null);
  const styleCache = useStyleCache();

  useEffect(() => {
    if (!styleCache || !statsDivRef.current) {
      return;
    }
    const update = () => {
      const msg = statsToString(styleCache);
      if (msg !== lastWrittenRef.current) {
        statsDivRef.current!.innerText = msg;
        lastWrittenRef.current = msg;
      }
    };
    const intId = setInterval(update, 200);
    update();
    return () => clearInterval(intId);
  }, [styleCache]);
  return <div ref={statsDivRef}>&nbsp;</div>;
};

const statsToString = (styleCache: StyleCache) => {
  const { calls, hits, misses } = styleCache.stats;
  const entries = styleCache.cache.size;
  return (
    "Cache: " +
    JSON.stringify({
      entries,
      misses,
      hits,
      calls
    })
  );
};
