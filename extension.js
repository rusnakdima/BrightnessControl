import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";
import Gio from "gi://Gio";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Slider } from "resource:///org/gnome/shell/ui/slider.js";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const BrightnessIndicator = GObject.registerClass(
  class BrightnessIndicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, "Brightness Indicator");

      this._icon = new St.Icon({
        icon_name: "display-brightness-symbolic",
        style_class: "system-status-icon",
      });
      this.add_child(this._icon);

      let sliderItem = new PopupMenu.PopupBaseMenuItem({ activate: false });
      this._slider = new Slider(0);
      this._slider.connect("notify::value", this._onSliderChanged.bind(this));

      sliderItem.add_child(this._slider);
      this.menu.addMenuItem(sliderItem);

      this._updateBrightness();

      this.connect("scroll-event", this._onScrollEvent.bind(this));
    }

    _onScrollEvent(actor, event) {
      let direction = event.get_scroll_direction();
      let currentValue = this._slider.value;

      if (direction === Clutter.ScrollDirection.UP) {
        this._slider.value = Math.min(currentValue + step, 1.0);
      } else if (direction === Clutter.ScrollDirection.DOWN) {
        this._slider.value = Math.max(currentValue - step, 0.0);
      }

      return Clutter.EVENT_STOP;
    }

    _onSliderChanged() {
      let brightness = Math.round(this._slider.value * 100);
      this._setBrightness(brightness);
    }

    _setBrightness(value) {
      try {
        let proc = Gio.Subprocess.new(
          ["brightnessctl", "set", `${value}%`],
          Gio.SubprocessFlags.NONE
        );
        proc.wait_async(null, () => {});
      } catch (e) {
        console.error(`Error setting brightness: ${e}`);
      }
    }

    _updateBrightness() {
      try {
        let proc = Gio.Subprocess.new(
          ["brightnessctl", "get"],
          Gio.SubprocessFlags.STDOUT_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            let [, stdout] = proc.communicate_utf8_finish(res);
            let current = parseInt(stdout.trim());

            let maxProc = Gio.Subprocess.new(
              ["brightnessctl", "max"],
              Gio.SubprocessFlags.STDOUT_PIPE
            );

            maxProc.communicate_utf8_async(null, null, (maxProc, maxRes) => {
              try {
                let [, maxStdout] = maxProc.communicate_utf8_finish(maxRes);
                let max = parseInt(maxStdout.trim());
                let percentage = current / max;
                this._slider.value = percentage;
              } catch (e) {
                console.error(`Error getting max brightness: ${e}`);
              }
            });
          } catch (e) {
            console.error(`Error getting current brightness: ${e}`);
          }
        });
      } catch (e) {
        console.error(`Error updating brightness: ${e}`);
      }
    }

    destroy() {
      super.destroy();
    }
  }
);

export default class BrightnessExtension extends Extension {
  enable() {
    this._indicator = new BrightnessIndicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
