import React from 'react';
import { Link as RRLink } from 'react-router-dom';
export default function Link({ href, children, ...rest }: any) {
  const to = typeof href === 'string' ? href : (href?.pathname ?? '/');
  return <RRLink to={to} {...rest}>{children}</RRLink>;
}
