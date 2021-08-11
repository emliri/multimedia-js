export type VoidCallback = () => void;

export type Nullable<T> = T | null;

export type LambdaFunc = (...args: any[]) => void;

export type LambdaNoArgFunc = () => void;

export type TwoDimArray<T> = T[][];

// Constructor-types as per the TypeScript Handbook
export type ObjectConstructor = new (...args: any[]) => {};
export type GenericConstructor<T = {}> = new (...args: any[]) => T;
// Generic constructor-type notation in an own twist
export type ConstructorOf<T extends Object> = new (...args: any[]) => T;

export type Class<T> = ConstructorOf<T>

export type Mixin<T1, T2> = ConstructorOf<T1> & ConstructorOf<T2>


