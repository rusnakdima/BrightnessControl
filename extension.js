import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { OsdWindow } from "resource:///org/gnome/shell/ui/osdWindow.js";
import * as Config from "resource:///org/gnome/shell/misc/config.js";

const BUS_NAME = "org.gnome.SettingsDaemon.Power";
const OBJECT_PATH = "/org/gnome/SettingsDaemon/Power";

const BrightnessInterface = `
<node>
  <interface name="org.gnome.SettingsDaemon.Power.Display">
    <property name="Brightness" type="i" access="readwrite"/>
  </interface>
</node>`;

function getBrightnessDevices() {
  const [success, stdout] = GLib.spawn_command_line_sync("brightnessctl -l");
  if (!success) return [];
  const output = stdout.toString();
  const lines = output.split("\n");
  const devices = [];
  let currentDevice = null;
  for (const line of lines) {
    if (line.startsWith("Device '")) {
      const deviceMatch = line.match(/Device '([^']+)' of class '([^']+)'/);
      if (deviceMatch && deviceMatch[2] === "backlight") {
        currentDevice = deviceMatch[1];
        devices.push(currentDevice);
      } else {
        currentDevice = null;
      }
    }
  }
  return devices;
}

async function getBrightnessAsync(device) {
  try {
    const proc = Gio.Subprocess.new(
      ["brightnessctl", "-d", device, "g"],
      Gio.SubprocessFlags.STDOUT_PIPE
    );
    const result = await new Promise((resolve, reject) => {
      proc.communicate_utf8_async(null, null, (proc, res) => {
        try {
          const [success, stdout] = proc.communicate_utf8_finish(res);
          resolve([success, stdout, proc.get_exit_status()]);
        } catch (e) {
          reject(e);
        }
      });
    });
    const [success, stdout, exit_status] = result;
    if (success && exit_status === 0) {
      return parseInt(stdout.trim());
    }
  } catch (e) {
    console.error("Error getting brightness:", e);
  }
  return null;
}

async function getMaxBrightnessAsync(device) {
  try {
    const proc = Gio.Subprocess.new(
      ["brightnessctl", "-d", device, "m"],
      Gio.SubprocessFlags.STDOUT_PIPE
    );
    const result = await new Promise((resolve, reject) => {
      proc.communicate_utf8_async(null, null, (proc, res) => {
        try {
          const [success, stdout] = proc.communicate_utf8_finish(res);
          resolve([success, stdout, proc.get_exit_status()]);
        } catch (e) {
          reject(e);
        }
      });
    });
    const [success, stdout, exit_status] = result;
    if (success && exit_status === 0) {
      return parseInt(stdout.trim());
    }
  } catch (e) {
    console.error("Error getting max brightness:", e);
  }
  return null;
}

function setBrightness(device, value) {
  const cmd = `brightnessctl -d ${device} s ${value}`;
  GLib.spawn_command_line_async(cmd);
}

function percentToAbs(percent, max) {
  return Math.round((percent / 100) * max);
}

function absToPercent(abs, max) {
  return Math.round((abs / max) * 100);
}

const BrightnessIndicator = GObject.registerClass(
  class BrightnessIndicator extends QuickSettings.SystemIndicator {
    _init() {
      super._init();

      this._indicator = this._addIndicator();
      this._indicator.icon_name = "display-brightness-symbolic";
      this._indicator.visible = true;
      this._indicator.reactive = true;

      this._devices = getBrightnessDevices();
      if (this._devices.length === 0) {
        console.warn("No brightness devices found");
        this._devices = ["dummy"];
      }

      this._max = null;
      let device = this._devices.find((d) => d !== "dummy");
      if (device) {
        getMaxBrightnessAsync(device)
          .then((max) => {
            this._max = max;
          })
          .catch(() => {
            console.warn("Failed to get max brightness");
          });
      }

      this._osdWindow = null;
      this._osdTimeoutId = null;

      this._scrollId = this._indicator.connect(
        "scroll-event",
        this._onScroll.bind(this)
      );

      const majorVersion = parseInt(Config.PACKAGE_VERSION);
      if (majorVersion < 49) {
        const BrightnessProxy =
          Gio.DBusProxy.makeProxyWrapper(BrightnessInterface);
        this._proxy = new BrightnessProxy(
          Gio.DBus.session,
          BUS_NAME,
          OBJECT_PATH,
          (proxy, error) => {
            if (error) {
              console.error("Failed to connect to brightness proxy:", error);
              return;
            }

            this._syncIndicatorVisibility();
          }
        );
        this._useDBus = true;
      } else {
        this._useDBus = false;
      }
    }

    _syncIndicatorVisibility() {
      if (this._proxy && this._proxy.g_name_owner) {
        this._indicator.visible = true;
      } else {
        this._indicator.visible = false;
      }
    }

    _showBrightnessOSD(brightness) {
      if (this._osdTimeoutId) {
        GLib.source_remove(this._osdTimeoutId);
        this._osdTimeoutId = null;
      }

      if (!this._osdWindow) {
        const monitorIndex = Main.layoutManager.focusMonitor.index || 0;
        this._osdWindow = new OsdWindow(monitorIndex);

        const icon = Gio.icon_new_for_string("display-brightness-symbolic");

        this._osdWindow.setIcon(icon);
        this._osdWindow.setLevel(brightness / 100);
        this._osdWindow.setLabel(`${brightness}%`);

        this._osdWindow.show();
      } else {
        this._osdWindow.setLevel(brightness / 100);
        this._osdWindow.setLabel(`${brightness}%`);

        this._osdWindow.show();
      }

      this._osdTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
        this._hideBrightnessOSD();
        this._osdTimeoutId = null;
        return GLib.SOURCE_REMOVE;
      });
    }

    _hideBrightnessOSD() {
      if (this._osdTimeoutId) {
        GLib.source_remove(this._osdTimeoutId);
        this._osdTimeoutId = null;
      }

      if (this._osdWindow) {
        this._osdWindow.cancel();
        this._osdWindow = null;
      }
    }

    _onScroll(actor, event) {
      if (this._useDBus) {
        if (!this._proxy || !this._proxy.g_name_owner) {
          return Clutter.EVENT_PROPAGATE;
        }

        const direction = event.get_scroll_direction();

        let delta = 0;
        if (direction === Clutter.ScrollDirection.UP) {
          delta = 5;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
          delta = -5;
        } else {
          return Clutter.EVENT_PROPAGATE;
        }

        if (this._proxy.Brightness === undefined) {
          return Clutter.EVENT_PROPAGATE;
        }

        const currentBrightness = this._proxy.Brightness;
        const newBrightness = Math.max(
          0,
          Math.min(100, currentBrightness + delta)
        );

        if (newBrightness !== currentBrightness) {
          this._proxy.Brightness = newBrightness;

          this._showBrightnessOSD(newBrightness);
        }

        return Clutter.EVENT_STOP;
      } else {
        const direction = event.get_scroll_direction();

        let delta = 0;
        if (direction === Clutter.ScrollDirection.UP) {
          delta = 5;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
          delta = -5;
        } else {
          return Clutter.EVENT_PROPAGATE;
        }

        const device = this._devices.find((d) => d !== "dummy");
        if (!device || !this._max) return Clutter.EVENT_PROPAGATE;

        getBrightnessAsync(device)
          .then((abs) => {
            if (abs === null) return;
            const currentBrightness = absToPercent(abs, this._max);
            const newBrightness = Math.max(
              0,
              Math.min(100, currentBrightness + delta)
            );

            if (newBrightness !== currentBrightness) {
              setBrightness(device, percentToAbs(newBrightness, this._max));
              this._showBrightnessOSD(newBrightness);
            }
          })
          .catch(() => {});

        return Clutter.EVENT_STOP;
      }
    }

    destroy() {
      this._hideBrightnessOSD();

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
      this._indicator._hideBrightnessOSD();
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
