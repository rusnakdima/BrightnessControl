import GObject from "gi://GObject";
import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const BRIGHTNESS_STEP = 0.02;

const BrightnessIndicator = GObject.registerClass(
  class BrightnessIndicator extends QuickSettings.SystemIndicator {
    _init() {
      super._init();

      this._indicator = this._addIndicator();
      this._indicator.icon_name = "display-brightness-symbolic";
      this._indicator.visible = false;

      if (Main.brightnessManager) {
        this._indicator.visible = true;
        this._indicator.reactive = true;

        this._scrollId = this._indicator.connect(
          "scroll-event",
          this._onScroll.bind(this)
        );
      } else {
        console.warn("[Brightness Control] brightnessManager not available");
      }
    }

    _onScroll(actor, event) {
      if (!Main.brightnessManager) {
        return Clutter.EVENT_PROPAGATE;
      }

      const direction = event.get_scroll_direction();

      let delta = 0;
      if (direction === Clutter.ScrollDirection.UP) {
        delta = BRIGHTNESS_STEP;
      } else if (direction === Clutter.ScrollDirection.DOWN) {
        delta = -BRIGHTNESS_STEP;
      } else if (direction === Clutter.ScrollDirection.SMOOTH) {
        const [, scrollDelta] = event.get_scroll_delta();
        delta = -scrollDelta * BRIGHTNESS_STEP;
      } else {
        return Clutter.EVENT_PROPAGATE;
      }

      const before =
        Main.brightnessManager.globalScale.value ??
        Main.brightnessManager.globalScale;

      const current = before;
      const newValue = Math.max(0, Math.min(1, current + delta));

      if (Math.abs(newValue - current) > 0.001) {
        if (Main.brightnessManager.globalScale.value !== undefined) {
          Main.brightnessManager.globalScale.value = newValue;
        } else {
          Main.brightnessManager.globalScale = newValue;
        }
      }

      return Clutter.EVENT_STOP;
    }

    destroy() {
      if (this._scrollId) {
        this._indicator.disconnect(this._scrollId);
        this._scrollId = null;
      }
      super.destroy();
    }
  }
);

export default class BrightnessExtension extends Extension {
  enable() {
    this._indicator = new BrightnessIndicator();

    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

    this._moveAfterVolume();
  }

  _moveAfterVolume() {
    const quickSettings = Main.panel.statusArea.quickSettings;
    const indicators = quickSettings._indicators;

    let volumeIndicator = null;
    for (let indicator of indicators.get_children()) {
      const children = indicator.get_children();
      for (let child of children) {
        if (child.icon_name && child.icon_name.includes("audio-volume")) {
          volumeIndicator = indicator;
          break;
        }
      }
      if (volumeIndicator) break;
    }

    if (volumeIndicator) {
      indicators.set_child_above_sibling(this._indicator, volumeIndicator);
    }
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
