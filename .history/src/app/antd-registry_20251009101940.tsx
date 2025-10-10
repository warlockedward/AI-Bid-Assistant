// cSpell:ignore cssinjs StyleProvider createCache extractStyle useServerInsertedHTML

'use client';

import React from 'react';
import type { Cache } from '@ant-design/cssinjs/lib';
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs/lib';
import { useServerInsertedHTML } from 'next/navigation';

const StyledComponentsRegistry = ({ children }: React.PropsWithChildren) => {
  const cache = React.useMemo<Cache>(() => createCache(), []);

  useServerInsertedHTML(() => (
    <style id="antd" dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }} />
  ));

  return <StyleProvider cache={cache}>{children}</StyleProvider>;
};

export default StyledComponentsRegistry;