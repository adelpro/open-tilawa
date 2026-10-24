import React from 'react';
export default function Image(props: any) {
  const { src, alt, width, height, priority, fill, style, className, ...rest } = props;
  const s = fill
    ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const, ...style }
    : { width, height, ...style };
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={s}
      loading={priority ? 'eager' : 'lazy'}
      {...rest}
    />
  );
}
