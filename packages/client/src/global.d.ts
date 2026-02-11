/**
 * Global type declarations for the Radlands client
 */

/// <reference types="@pixi/react/global" />

declare module '@pixi/react' {
  export function extend(objects: { [key: string]: new (...args: any) => any }): void;
  export { Application } from '@pixi/react';
}
