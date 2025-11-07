import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const BUS_NAME = "org.gnome.SettingsDaemon.Power";
const OBJECT_PATH = "/org/gnome/SettingsDaemon/Power";

const BrightnessInterface = `
<node>
  <interface name="org.gnome.SettingsDaemon.Power.Screen">
    <property name="Brightness" type="i" access="readwrite"/>
  </interface>
</node>`;

const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(BrightnessInterface);

const BrightnessIndicator = GObject.registerClass(
  class BrightnessIndicator extends QuickSettings.SystemIndicator {
    _init() {
      super._init();

      this._indicator = this._addIndicator();
      this._indicator.icon_name = "display-brightness-symbolic";
      this._indicator.visible = true;

      this._indicator.reactive = true;

      this._proxy = new BrightnessProxy(
        Gio.DBus.session,
        BUS_NAME,
        OBJECT_PATH,
        (proxy, error) => {
          if (error) {
            console.error("Failed to connect to brightness proxy:", error);
          }
        }
      );

      this._scrollId = this._indicator.connect(
        "scroll-event",
        this._onScroll.bind(this)
      );
    }

    _onScroll(actor, event) {
      const direction = event.get_scroll_direction();

      let delta = 0;
      if (direction === Clutter.ScrollDirection.UP) {
        delta = 5;
      } else if (direction === Clutter.ScrollDirection.DOWN) {
        delta = -5;
      } else {
        return Clutter.EVENT_PROPAGATE;
      }

      const currentBrightness = this._proxy.Brightness;
      const newBrightness = Math.max(
        0,
        Math.min(100, currentBrightness + delta)
      );
      this._proxy.Brightness = newBrightness;

      return Clutter.EVENT_STOP;
    }

    destroy() {
      if (this._scrollId) {
        this._indicator.disconnect(this._scrollId);
        this._scrollId = null;
      }
      if (this._proxy) {
        this._proxy = null;
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
