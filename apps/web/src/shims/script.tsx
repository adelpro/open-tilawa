import React from 'react';
export default function Script(props: any) {
  const { children, ...rest } = props;
  return <script {...rest}>{children}</script>;
}
