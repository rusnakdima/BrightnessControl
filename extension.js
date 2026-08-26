import GObject from "gi://GObject";
import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

// Accumulated smooth-scroll delta needed before we take one brightness step.
const SMOOTH_SCROLL_THRESHOLD = 1.0;

const BrightnessIndicator = GObject.registerClass(
  class BrightnessIndicator extends QuickSettings.SystemIndicator {
    _init() {
      super._init();

      this._smoothDelta = 0;

      this._indicator = this._addIndicator();
      this._indicator.icon_name = "display-brightness-symbolic";
      this._indicator.reactive = true;
      this._indicator.visible = false;

      const manager = Main.brightnessManager;
      if (!manager) {
        console.warn("[Brightness Control] brightnessManager not available");
        return;
      }

      this._scrollId = this._indicator.connect(
        "scroll-event",
        this._onScroll.bind(this)
      );

      // globalScale is null while no backlight-capable monitor is active,
      // and comes and goes as monitors are plugged in or out.
      this._changedId = manager.connect("changed", () => this._sync());
      this._sync();
    }

    _sync() {
      this._indicator.visible = !!Main.brightnessManager?.globalScale;
    }

    _onScroll(actor, event) {
      const scale = Main.brightnessManager?.globalScale;
      if (!scale) {
        return Clutter.EVENT_PROPAGATE;
      }

      switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
          scale.stepUp();
          break;

        case Clutter.ScrollDirection.DOWN:
          scale.stepDown();
          break;

        case Clutter.ScrollDirection.SMOOTH: {
          const [, dy] = event.get_scroll_delta();
          this._smoothDelta += dy;
          while (this._smoothDelta <= -SMOOTH_SCROLL_THRESHOLD) {
            this._smoothDelta += SMOOTH_SCROLL_THRESHOLD;
            scale.stepUp();
          }
          while (this._smoothDelta >= SMOOTH_SCROLL_THRESHOLD) {
            this._smoothDelta -= SMOOTH_SCROLL_THRESHOLD;
            scale.stepDown();
          }
          break;
        }

        default:
          return Clutter.EVENT_PROPAGATE;
      }

      return Clutter.EVENT_STOP;
    }

    destroy() {
      if (this._scrollId) {
        this._indicator.disconnect(this._scrollId);
        this._scrollId = null;
      }
      if (this._changedId) {
        Main.brightnessManager?.disconnect(this._changedId);
        this._changedId = null;
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
    const indicators = Main.panel.statusArea.quickSettings?._indicators;
    if (!indicators) {
      return;
    }

    for (const indicator of indicators.get_children()) {
      if (indicator === this._indicator) {
        continue;
      }
      const isVolume = indicator
        .get_children()
        .some((child) => child.icon_name?.includes("audio-volume"));
      if (isVolume) {
        indicators.set_child_above_sibling(this._indicator, indicator);
        return;
      }
    }
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
