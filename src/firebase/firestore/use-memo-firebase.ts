
'use client';

import { useMemo, useRef } from 'react';

/**
 * A hook to memoize Firebase references and queries.
 * It uses a ref to store the previous dependencies and only re-evaluates
 * the factory when the dependencies change, ensuring stable references
 * for other hooks like useCollection and useDoc.
 */
export function useMemoFirebase<T>(factory: () => T, deps: any[]): T {
  const depsRef = useRef(deps);
  const valueRef = useRef<T>(null as T);

  return useMemo(() => {
    const depsChanged = deps.some((dep, i) => dep !== depsRef.current[i]);
    if (depsChanged || valueRef.current === null) {
      depsRef.current = deps;
      valueRef.current = factory();
    }
    return valueRef.current;
  }, deps);
}
