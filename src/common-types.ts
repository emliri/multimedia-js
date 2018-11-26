export type VoidCallback = () => void;

export type OneDeepNestedArray<T> = T[][];
export type TwoDeepNestedArray<T> = T[][][];
export type ThreeDeepNestedArray<T> = T[][][];

export type SomeNestedArray<T> = OneDeepNestedArray<T> | TwoDeepNestedArray<T> | ThreeDeepNestedArray<T>;
