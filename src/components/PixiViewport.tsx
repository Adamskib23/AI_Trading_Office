// Based on https://codepen.io/inlet/pen/yLVmPWv.
// Copyright (c) 2018 Patrick Brouwer, distributed under the MIT license.

import { PixiComponent, useApp } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { Application } from 'pixi.js';
import { MutableRefObject, ReactNode } from 'react';

export type ViewportProps = {
  app: Application;
  viewportRef?: MutableRefObject<Viewport | undefined>;

  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  children?: ReactNode;
};

// https://davidfig.github.io/pixi-viewport/jsdoc/Viewport.html
export default PixiComponent('Viewport', {
  create(props: ViewportProps) {
    const { app, children, viewportRef, ...viewportProps } = props;
    const viewport = new Viewport({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      events: app.renderer.events,
      passiveWheel: false,
      ...viewportProps,
    });
    // Stage can destroy its EventSystem before reconciling this child on tab changes.
    // Retain the actual canvas for wheel-listener cleanup rather than consulting a
    // now-null EventSystem.domElement during Viewport.destroy().
    const wheelElement = app.renderer.events.domElement;
    viewport.input.destroy = () => {
      if (viewport.input.wheelFunction)
        wheelElement.removeEventListener('wheel', viewport.input.wheelFunction);
    };
    if (viewportRef) {
      viewportRef.current = viewport;
    }
    // Activate plugins
    viewport
      .drag()
      .pinch({})
      .wheel()
      .decelerate()
      .clamp({ direction: 'all', underflow: 'center' })
      .setZoom(
        Math.min(props.screenWidth / props.worldWidth, props.screenHeight / props.worldHeight) *
          0.92,
      )
      .moveCenter(props.worldWidth / 2, props.worldHeight / 2)
      .clampZoom({
        minScale:
          Math.min(props.screenWidth / props.worldWidth, props.screenHeight / props.worldHeight) *
          0.8,
        maxScale: 3.0,
      });
    return viewport;
  },
  applyProps(viewport, oldProps: ViewportProps, newProps: ViewportProps) {
    if (
      oldProps.screenWidth !== newProps.screenWidth ||
      oldProps.screenHeight !== newProps.screenHeight ||
      oldProps.worldWidth !== newProps.worldWidth ||
      oldProps.worldHeight !== newProps.worldHeight
    ) {
      viewport.resize(
        newProps.screenWidth,
        newProps.screenHeight,
        newProps.worldWidth,
        newProps.worldHeight,
      );
      viewport
        .setZoom(
          Math.min(
            newProps.screenWidth / newProps.worldWidth,
            newProps.screenHeight / newProps.worldHeight,
          ) * 0.92,
        )
        .moveCenter(newProps.worldWidth / 2, newProps.worldHeight / 2);
    }
  },
});
