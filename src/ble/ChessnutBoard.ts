import { BleManager, Device, State, type Subscription } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { bytesToBase64, base64ToBytes } from '../utils/base64';
import {
  CHESSNUT_UUIDS,
  COMMANDS,
  buildLedCommand,
  isBoardFrame,
  parseBoardFrame,
  parseBatteryNotification,
  type BatteryStatus,
  type Occupancy,
} from './protocol';

export type BoardStatus = 'idle' | 'scanning' | 'connecting' | 'connected';

export interface BoardEvents {
  onStatus: (status: BoardStatus, deviceName?: string) => void;
  onFrame: (occupancy: Occupancy, receivedAt: number) => void;
  onBattery: (battery: BatteryStatus) => void;
  onError: (message: string) => void;
}

const SCAN_TIMEOUT_MS = 15_000;
const LED_MIN_INTERVAL_MS = 200;
const BATTERY_POLL_MS = 60_000;

/**
 * Owns the BLE connection to a Chessnut Air/Air+/Pro board.
 * Pure byte handling lives in protocol.ts; this class only does transport.
 */
export class ChessnutBoard {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private subscriptions: Subscription[] = [];
  private batteryTimer: ReturnType<typeof setInterval> | null = null;
  private userDisconnected = false;

  // LED throttle: at most one write per LED_MIN_INTERVAL_MS, always ending on the latest state.
  private lastLedWriteAt = 0;
  private pendingLeds: string[] | null = null;
  private ledFlushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private events: BoardEvents) {}

  get isConnected(): boolean {
    return this.device !== null;
  }

  private getManager(): BleManager {
    if (!this.manager) this.manager = new BleManager();
    return this.manager;
  }

  async connect(): Promise<void> {
    if (this.device) return;
    this.userDisconnected = false;

    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
    }

    const manager = this.getManager();
    await this.waitForPoweredOn(manager);

    this.events.onStatus('scanning');
    let found: Device;
    try {
      found = await this.scanForBoard(manager);
    } catch (e) {
      this.events.onStatus('idle');
      throw e;
    }

    this.events.onStatus('connecting', found.name ?? undefined);
    try {
      const device = await found.connect();
      await device.discoverAllServicesAndCharacteristics();
      this.device = device;

      device.onDisconnected(() => this.handleDisconnect());

      this.subscribe(CHESSNUT_UUIDS.boardService, CHESSNUT_UUIDS.boardNotify);
      this.subscribe(CHESSNUT_UUIDS.opsService, CHESSNUT_UUIDS.miscNotify);

      await this.write(COMMANDS.enableRealtime);
      await this.write(COMMANDS.queryBattery);
      this.batteryTimer = setInterval(() => {
        this.write(COMMANDS.queryBattery).catch(() => {});
      }, BATTERY_POLL_MS);

      this.events.onStatus('connected', device.name ?? undefined);
    } catch (e) {
      this.cleanup();
      this.events.onStatus('idle');
      throw e;
    }
  }

  private waitForPoweredOn(manager: BleManager): Promise<void> {
    return new Promise((resolve, reject) => {
      const sub = manager.onStateChange((state) => {
        if (state === State.PoweredOn) {
          sub.remove();
          resolve();
        } else if (state === State.Unsupported || state === State.Unauthorized) {
          sub.remove();
          reject(new Error(`Bluetooth is ${state.toLowerCase()}`));
        }
      }, true);
    });
  }

  private scanForBoard(manager: BleManager): Promise<Device> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        manager.stopDeviceScan();
        reject(new Error('No Chessnut board found. Is it turned on?'));
      }, SCAN_TIMEOUT_MS);

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          clearTimeout(timeout);
          manager.stopDeviceScan();
          reject(error);
          return;
        }
        const name = device?.name ?? device?.localName ?? '';
        if (device && (name.includes('Chessnut') || name.includes('Smart Chess')) && !name.includes('Chessnut Move')) {
          clearTimeout(timeout);
          manager.stopDeviceScan();
          resolve(device);
        }
      });
    });
  }

  private subscribe(serviceUUID: string, characteristicUUID: string): void {
    if (!this.device) return;
    const sub = this.device.monitorCharacteristicForService(
      serviceUUID,
      characteristicUUID,
      (error, characteristic) => {
        if (error) {
          // Disconnection surfaces here too; handled by onDisconnected.
          return;
        }
        if (!characteristic?.value) return;
        this.handleNotification(base64ToBytes(characteristic.value));
      }
    );
    this.subscriptions.push(sub);
  }

  private handleNotification(data: Uint8Array): void {
    if (isBoardFrame(data)) {
      this.events.onFrame(parseBoardFrame(data), Date.now());
      return;
    }
    const battery = parseBatteryNotification(data);
    if (battery) this.events.onBattery(battery);
  }

  private async write(command: Uint8Array): Promise<void> {
    if (!this.device) throw new Error('Board not connected');
    await this.device.writeCharacteristicWithoutResponseForService(
      CHESSNUT_UUIDS.opsService,
      CHESSNUT_UUIDS.write,
      bytesToBase64(command)
    );
  }

  /**
   * Replace the board's lit LEDs with exactly `squares` (algebraic names).
   * Throttled to one write per 200 ms; intermediate states are skipped but the
   * latest requested state is always flushed.
   */
  setLeds(squares: string[]): void {
    this.pendingLeds = squares;
    if (this.ledFlushTimer) return;
    const elapsed = Date.now() - this.lastLedWriteAt;
    const delay = Math.max(0, LED_MIN_INTERVAL_MS - elapsed);
    this.ledFlushTimer = setTimeout(() => this.flushLeds(), delay);
  }

  private flushLeds(): void {
    this.ledFlushTimer = null;
    if (this.pendingLeds === null || !this.device) return;
    const squares = this.pendingLeds;
    this.pendingLeds = null;
    this.lastLedWriteAt = Date.now();
    this.write(buildLedCommand(squares)).catch((e) => {
      this.events.onError(`LED write failed: ${e.message}`);
    });
  }

  /** Beep the board's buzzer (frequency Hz, duration ms). */
  async beep(frequency = 1000, durationMs = 300): Promise<void> {
    if (!this.device) return;
    const cmd = Uint8Array.from([
      0x0b,
      0x04,
      (frequency >> 8) & 0xff,
      frequency & 0xff,
      (durationMs >> 8) & 0xff,
      durationMs & 0xff,
    ]);
    await this.write(cmd).catch(() => {});
  }

  private handleDisconnect(): void {
    const wasIntentional = this.userDisconnected;
    this.cleanup();
    this.events.onStatus('idle');
    if (!wasIntentional) {
      this.events.onError('Board disconnected');
      // One automatic reconnect attempt; the user can retry manually after that.
      this.connect().catch(() => {});
    }
  }

  async disconnect(): Promise<void> {
    this.userDisconnected = true;
    const device = this.device;
    this.cleanup();
    if (device) {
      await device.cancelConnection().catch(() => {});
    }
    this.events.onStatus('idle');
  }

  private cleanup(): void {
    for (const sub of this.subscriptions) sub.remove();
    this.subscriptions = [];
    if (this.batteryTimer) {
      clearInterval(this.batteryTimer);
      this.batteryTimer = null;
    }
    if (this.ledFlushTimer) {
      clearTimeout(this.ledFlushTimer);
      this.ledFlushTimer = null;
    }
    this.pendingLeds = null;
    this.device = null;
  }
}
