// @ts-ignore
import { UAParser } from 'ua-parser-js';
import { IDeviceInfo, DeviceOS, DeviceType } from '@/types';
import crypto from 'crypto';

export class DeviceDetector {
  private parser: UAParser;

  constructor(userAgent: string) {
    this.parser = new UAParser(userAgent);
  }

  /**
   * Detect device information from user agent
   */
  detect(): IDeviceInfo {
    const result = this.parser.getResult();

    const os = this.mapOS(result.os.name);
    const type = this.mapDeviceType(result.device.type);
    const browser = result.browser.name;

    return {
      os,
      type,
      browser,
      model: result.device.model,
    };
  }

  /**
   * Get the operating system
   */
  getOS(): DeviceOS {
    return this.mapOS(this.parser.getOS().name);
  }

  /**
   * Get device type
   */
  getDeviceType(): DeviceType {
    return this.mapDeviceType(this.parser.getDevice().type);
  }

  /**
   * Get browser name
   */
  getBrowser(): string | undefined {
    return this.parser.getBrowser().name;
  }

  /**
   * Check if device appears to be mobile
   */
  isMobile(): boolean {
    const os = this.getOS();
    return os === 'android' || os === 'ios';
  }

  /**
   * Check if device appears to be app installable (not web-only)
   */
  isAppTargetable(): boolean {
    const os = this.getOS();
    return os === 'android' || os === 'ios';
  }

  /**
   * Get hash of user agent (for fingerprinting)
   */
  static hashUserAgent(userAgent: string): string {
    return crypto
      .createHash('sha256')
      .update(userAgent)
      .digest('hex');
  }

  /**
   * Map OS name to standard enum
   */
  private mapOS(osName?: string): DeviceOS {
    if (!osName) return 'other';

    const normalized = osName.toLowerCase();

    if (normalized.includes('android')) return 'android';
    if (normalized.includes('iphone') || normalized.includes('ios')) return 'ios';
    if (normalized.includes('windows')) return 'windows';
    if (normalized.includes('mac')) return 'macos';
    if (normalized.includes('linux')) return 'linux';

    return 'other';
  }

  /**
   * Map device type to standard enum
   */
  private mapDeviceType(deviceType?: string): DeviceType {
    if (!deviceType) return 'desktop';

    const normalized = deviceType.toLowerCase();

    if (normalized.includes('mobile')) return 'mobile';
    if (normalized.includes('tablet')) return 'tablet';

    return 'desktop';
  }
}

export default DeviceDetector;
