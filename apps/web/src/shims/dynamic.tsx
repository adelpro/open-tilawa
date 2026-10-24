import React from 'react';
export default function dynamic(loader: () => Promise<any>, opts?: any) {
  const Comp = React.lazy(loader);
  return function DynamicWrapper(props: any) {
    return (
      <React.Suspense fallback={opts?.loading ? opts.loading() : null}>
        <Comp {...props} />
      </React.Suspense>
    );
  };
}
