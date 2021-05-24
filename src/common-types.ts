export type VoidCallback = () => void;
export type Nullable<T> = T | null;

export type OneDeepNestedArray<T> = T[][];
export type TwoDeepNestedArray<T> = T[][][];
export type ThreeDeepNestedArray<T> = T[][][];

export type SomeNestedArray<T> = OneDeepNestedArray<T> | TwoDeepNestedArray<T> | ThreeDeepNestedArray<T>;
