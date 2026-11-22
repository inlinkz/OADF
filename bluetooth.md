# Bluetooth

Two radios feed aim traces. **Xiao** is the Seeed XIAO nRF52840 Sense firmware in the Xiao project. **Mantis** is the MantisX family. The Flutter client speaks both. This file is the GATT map and the packet layout each one uses.

Bytes are numbered from 0. Multi-byte integers say their endianness. UUIDs are written in the 128-bit form a client compares.

## Xiao

Board: Seeed XIAO nRF52840 Sense. IMU is the LSM6DS3 at I2C `0x6A`. Accelerometer full scale is ±16 g. Gyroscope full scale is ±2000 °/s. Both run at 833 Hz. The microphone is PDM, one channel, 16 kHz, gain 30.

The firmware samples the aim stream at **400 Hz** (one sample every 2500 µs). Eight samples fill one notify, so a packet leaves about every 20 ms.

### Advertisement

| Field | Value |
| --- | --- |
| Local name | `XIAO` plus the last two octets of the BLE address, uppercase. Address `aa:bb:cc:dd:ee:ff` advertises as `XIAOEEFF` |
| Device name | Same string as the local name |
| Connection interval | 7.5 ms to 15 ms (`BLE.setConnectionInterval(6, 12)`, units of 1.25 ms) |

The client keeps a device whose advertised name starts with `xiao`, ignoring case. After connect it requests MTU 185 and, on Android, high connection priority. Notifications start as soon as the stream characteristic is found. There is no calibration write.

### GATT

| Service | UUID | Characteristic | UUID | Properties | Value |
| --- | --- | --- | --- | --- | --- |
| Device Information | `0000180a-0000-1000-8000-00805f9b34fb` | Firmware Revision | `00002a26-0000-1000-8000-00805f9b34fb` | Read | ASCII `"0.1"` |
| Battery | `0000180f-0000-1000-8000-00805f9b34fb` | Battery Level | `00002a19-0000-1000-8000-00805f9b34fb` | Read | `uint8` percent. Firmware writes `100` |
| Xiao | `8f3a0001-5c2e-4b1a-9d47-6e5f4a3b2c10` | Stream | `8f3a0002-5c2e-4b1a-9d47-6e5f4a3b2c10` | Notify | 54 bytes. See the packet below |

The stream is notified only while a client has subscribed. The firmware does not send it otherwise.

### Stream packet

54 bytes, little-endian. The client drops any other length, and drops a packet whose count byte is not 8.

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | `uint8` | Sequence. Increments by 1 for each packet, wraps at 256 |
| 1 | `uint8` | Sample count. Always `8` |
| 2 | 8 × 6 bytes | Samples, in time order. See the row below |
| 50 | `int16` | Pitch of the last sample in this packet, in tenths of a degree |
| 52 | `int16` | Yaw of the last sample in this packet, in tenths of a degree |

Each sample is three little-endian `int16` values:

| Offset in the sample | Scale | Meaning |
| --- | --- | --- |
| 0 | value / 100 | Jerk. Non-negative on the wire when the sensor is quiet; the client does not take an absolute value |
| 2 | value / 10 | Gyro X, degrees per second |
| 4 | value / 10 | Gyro Z, degrees per second |

Pitch and yaw are one pair for the whole packet. The client copies that pair onto all eight samples. Pitch is positive when the nose is up. Yaw is positive to the right of the board's accelerometer frame. Both are tilt from gravity, not an integrated gyro angle:

```text
pitch = atan2(-ax, hypot(ay, az)) in degrees
yaw   = atan2( ay, hypot(ax, az)) in degrees
```

`ax`, `ay`, `az` are accelerometer readings in g. Each axis is high-pass filtered (`alpha = 0.76`) before the jerk magnitude. Jerk is that magnitude times 80. If the microphone RMS is more than 3 times its slow floor, the excess ratio times 4 is added, capped at 500. Values are clamped to `int16` before they are written.

The client feeds aim integration in the same counts as a Mantis gyro: ±32768 counts is ±2000 °/s.

```text
counts = (tenths / 10) * 32768 / 2000
```

Pitch and yaw are already degrees (`int16 / 10`). They are the packet angles, not a second integration.

## Mantis

MantisX sensors (X2 and later) share one custom UUID base. The 96-bit tail is the ASCII bytes of  `Mantis Tech` (leading space):

```text
6e40xxxx-204d-616e-7469-732054656368
```

V1 sensors are a separate HM-10 UART. The Flutter client does not speak V1. It requires the V2 data, calibration, serial, firmware, hardware, packet-type, and sample-rate characteristics.

### Advertisement

The client scans with no service filter and keeps a device whose name starts with `mantis`, ignoring case. A name `mantis123456` is shown as `MantisX-123456` (the `man` prefix is dropped).

Manufacturer data uses company id `0x0761` (Mantis Tech). The payload is an ASCII model key. Null bytes are skipped. If the first two bytes are `61 07` (the company id repeated little-endian), those two bytes are skipped as well. An empty or missing payload is treated as `V1`.

| Key | Device |
| --- | --- |
| `V1` | Original MantisX. HM-10 UART |
| `X2` | MantisX X2 |
| `X3` | MantisX X3 |
| `X7` | MantisX X7 |
| `X8` | MantisX X8 |
| `X10` | MantisX X10 (TitanX) |
| `X11` | MantisX X11. Skips hardware calibration |
| `D1` | Dry Fire Mag |
| `BBX` | BlackbeardX. E-packets at 200 Hz. 400 Hz sample-rate code is `3`, not `4` |
| `TORX` | TORX |
| `XWP` | XWP |
| `XLP` | TitanX Laser |
| `BBG` | BBG |

### GATT

| Service | UUID | Role |
| --- | --- | --- |
| MantisX | `6e400001-204d-616e-7469-732054656368` | Custom characteristics |
| Device Information | `0000180a-0000-1000-8000-00805f9b34fb` | Serial, firmware, hardware |
| Battery | `0000180f-0000-1000-8000-00805f9b34fb` | Battery level |
| Nordic DFU | `0000fe59-0000-1000-8000-00805f9b34fb` | Buttonless secure DFU |
| HM-10 UART | `0000ffe0-0000-1000-8000-00805f9b34fb` | V1 only |

Notify characteristics use the standard CCCD `00002902-0000-1000-8000-00805f9b34fb`. Enable is `0x0100`. Disable is `0x0000`. Writes that carry a command use a write-with-response. Android runs one GATT operation at a time; the client queues reads, writes, and CCCD updates.

#### Device Information and battery

| UUID | Name | Properties | Payload |
| --- | --- | --- | --- |
| `00002a25-0000-1000-8000-00805f9b34fb` | Serial Number | Read | ASCII. `0xFF` bytes mean no serial |
| `00002a26-0000-1000-8000-00805f9b34fb` | Firmware Revision | Read | ASCII, often an integer such as `150` |
| `00002a27-0000-1000-8000-00805f9b34fb` | Hardware Revision | Read | ASCII. `0C` means 12 |
| `00002a19-0000-1000-8000-00805f9b34fb` | Battery Level | Read | `uint8` percent, 0–100 |

#### V1

| UUID | Name | Properties | Payload |
| --- | --- | --- | --- |
| `0000ffe1-0000-1000-8000-00805f9b34fb` | V1 data | Notify | 20 bytes. See V1 packets |

#### MantisX custom service

| UUID | Name | Properties | Payload |
| --- | --- | --- | --- |
| `6e400002-204d-616e-7469-732054656368` | Command | Write, write without response | Present on some radios. The archery client does not use it |
| `6e400003-204d-616e-7469-732054656368` | Data | Notify | H or I packet, 76 or 148 bytes. E packet, 76 bytes |
| `6e400005-204d-616e-7469-732054656368` | Packet type | Write | 1 byte. `2` E, `5` H, `6` I |
| `6e400006-204d-616e-7469-732054656368` | Sample rate | Write | 1 byte. See the rate table |
| `6e40000a-204d-616e-7469-732054656368` | Calibration | Read, write, notify | Write `0x01` to start. Read `0x00` when finished |
| `6e40000d-204d-616e-7469-732054656368` | Mount | Read, write | 1 byte. See mount |
| `6e40000e-204d-616e-7469-732054656368` | Button shot | Notify | 1 byte. `1` forces a shot |
| `6e40000f-204d-616e-7469-732054656368` | Magazine | Notify | 1 byte. `0` out, `1` in |
| `6e400012-204d-616e-7469-732054656368` | Wi-Fi SSID | Read, write | UTF-8 |
| `6e400013-204d-616e-7469-732054656368` | Wi-Fi password | Read, write | UTF-8 |
| `6e400014-204d-616e-7469-732054656368` | Wi-Fi connect | Write | `0x01` to connect |
| `6e400015-204d-616e-7469-732054656368` | Server IP | Read, write | UTF-8 |
| `6e400016-204d-616e-7469-732054656368` | Server port | Read, write | UTF-8. Drop the last byte on read |
| `6e400017-204d-616e-7469-732054656368` | Server start | Write | `0x01` to start |
| `6e400018-204d-616e-7469-732054656368` | IP address | Read, write | 4 octets |
| `6e400019-204d-616e-7469-732054656368` | Admin password | Write, notify | UTF-8. Notify `0` means success |
| `6e40001a-204d-616e-7469-732054656368` | Netmask | Read, write | 4 octets |
| `6e40001c-204d-616e-7469-732054656368` | Change password | Write | UTF-8 |
| `6e400020-204d-616e-7469-732054656368` | Sleep timer | Read, write | 1 byte, minutes. Minimum 1 |
| `6e400021-204d-616e-7469-732054656368` | Button | Notify | `0x01` long press (power off), `0x02` single press |

The archery client reads serial, firmware, hardware, battery, and sleep. It subscribes to calibration, button, and magazine when those characteristics exist. It writes mount `0` (bottom, forward) when mount exists. Wi-Fi, server, admin, button-shot, and DFU characteristics are part of the radio and are not used for aim.

### Handshake

Connect with `autoConnect` false. On Android, request high connection priority before streaming. A 400 Hz stream drops packets on the default interval.

For a V2 sensor that is not an X11:

1. Subscribe to calibration.
2. Read serial, firmware, hardware, battery, and sleep.
3. Subscribe to button and magazine when present.
4. Write mount `[0]` when present.
5. Write calibration `[0x01]`.
6. Read calibration every 2 seconds, up to 15 times. Byte 0 equal to `0x00` means calibrated.
7. Subscribe to data, then unsubscribe. This primes the radio. Config written before the first subscribe is ignored.
8. Write packet type `[0x05]` (H) and sample rate `[0x04]` (400 Hz).
9. Subscribe to data again.

X11 skips the calibration write and is treated as already calibrated. The first notify after subscribe is often a 69-byte runt. The client drops any buffer that is not 76 or 148 bytes, and any buffer whose first byte is not `H` (`0x48`) or `I` (`0x49`).

### Packet type and sample rate

| Type byte | Letter | Rate | Size | Contents |
| --- | --- | --- | --- | --- |
| `5` | H | 400 Hz | 76 or 148 | Jerk, gyro X, gyro Z, pitch, yaw |
| `6` | I | 400 Hz | 76 or 148 | Same layout as H. Header byte is `I` |
| `2` | E | 200 Hz | 76 | Six-axis IMU. The archery client does not parse it |
| V1 | A–D | 100 Hz | 20 | Legacy UART framing |

| Rate byte | Samples per second | Device |
| --- | --- | --- |
| `4` | 400 | H and I, not BlackbeardX |
| `3` | 400 | H and I on BlackbeardX |
| `9` | 200 | E, not BlackbeardX |
| `7` | 200 | E on BlackbeardX |

The archery client always writes type `5` and rate `4`.

### Mount

One byte: position base plus a direction bit. Forward is `0`. Backward is `1`.

| Position | Base |
| --- | --- |
| Bottom | 0 |
| Live | 2 |
| Left | 4 |
| Top (right) | 6 |

Bottom and forward is `0`. Bottom and backward is `1`. Left and forward is `4`. Top and backward is `7`.

### H and I packet

76 bytes is one packet: a header and 6 blocks, **12 samples**. 148 bytes is a double packet: a header and 12 blocks, **24 samples**. Both run at 400 Hz, so a single packet covers 30 ms and a double packet covers 60 ms.

| Offset | Size | Meaning |
| --- | --- | --- |
| 0 | 1 | `0x48` (`H`) or `0x49` (`I`) |
| 1 | 1 | Sequence, 0–255, wraps |
| 2 | 12 × N | Blocks. N is 6 or 12 |

Each block is 12 bytes. The first 9 bytes are six big-endian signed shorts, nibble-packed. The last 3 bytes are pitch and yaw, packed the same way. Both samples in a block share that pitch and yaw.

Nibble unpack of three bytes `b0 b1 b2` into two big-endian signed shorts:

```text
n0 = (b0 >> 4) & 0x0F
n1 = ((b0 << 4) | (b1 >> 4)) & 0xFF
n2 = b1 & 0x0F
n3 = b2
short0 = sign16((n0 << 8) | n1)
short1 = sign16((n2 << 8) | n3)
```

`sign16` subtracts `0x10000` when the value is at least `0x8000`. Three groups of the sensor bytes produce six shorts, in this order:

| Short | Sample | Field |
| --- | --- | --- |
| 0 | A | Jerk |
| 1 | A | Gyro X |
| 2 | A | Gyro Z |
| 3 | B | Jerk |
| 4 | B | Gyro X |
| 5 | B | Gyro Z |

Jerk, gyro X, and gyro Z are a 16-bit compressed float. The high 7 bits are the exponent. The low 9 bits are a signed mantissa. Jerk is stored as the absolute value after decompression. Gyro stays signed.

```text
exponent = (raw >> 9) & 0xFF
mantissa = raw & 0x1FF
if mantissa has bit 8 set: mantissa = mantissa - 512
if exponent > 0:
    mantissa = sign16(mantissa xor 0x100)
    exponent = (exponent - 1) & 0xFF
shift = 9 - exponent
fraction = 0 when shift is outside 0..30, otherwise (0x100 >> shift)
if fraction > 0: fraction = fraction - 0.5
value = (mantissa << exponent) + fraction
```

The client treats those gyro values as raw counts. ±32768 counts is ±2000 °/s (`degrees = counts * 2000 / 32768`). Full-scale accelerometer on the sensor is ±16 g. Shot detection thresholds the decompressed jerk itself, not a scaled g value. A quiet code sits near 0.5. The default bow threshold is 200.

Pitch and yaw come from the last three bytes of the block, unpacked into two signed shorts the same way as one nibble group:

```text
pitch = (short0 / 4095) * 180
if pitch > 90: pitch = pitch - 180
pitch = -pitch

yaw = (short1 / 4095) * 360
if yaw > 180: yaw = yaw - 360
```

Pitch is in −90..90 degrees. Yaw is in −180..180 degrees. Positive pitch is up. Positive yaw is right. H and I do not carry roll or gyro Y.

### E packet

76 bytes, 200 Hz, six samples. The archery client rejects this header.

| Offset | Size | Meaning |
| --- | --- | --- |
| 0 | 1 | `0x45` (`E`) |
| 1 | 1 | Sequence |
| 2 | 72 | Six samples. Each sample is six little-endian `int16`: gyro Y, gyro X, gyro Z, accel Y, accel X, accel Z |
| 74 | 1 | Absolute bearing, bit-reversed |
| 75 | 1 | Shot button, bit-reversed. `0xFF` means no button |

Counts use the same full scale as H: accelerometer ±16 g, gyroscope ±2000 °/s, so a count converts with `fullScale / 32768`.

### V1 packet

20 bytes, 100 Hz, on `0000ffe1-…`. Byte 0 is `A`, `B`, `C`, or `D`. Bytes 2–19 are nine little-endian `int16` values. `D` carries the serial. `A`, then `B`, then `C` complete one IMU frame. On `B`, a sub-header of `1` means ±2000 °/s; any other value means ±500 °/s. A V1 link also uses a 3-second watchdog: no data in that window drops the connection. V2 links do not.

## What the aim trace stores

Both radios are reduced to the same sample before they are drawn or written into an OADF aim series: jerk, gyro X, gyro Z, pitch, yaw, and the packet sequence. The stored aim trace is degrees at 400 Hz in a CSV sidecar (`yaw,pitch`). Yaw is positive right. Pitch is positive up. Time zero is the release. That file layout is in `OADF.md`, under Series. The Bluetooth numbers in this file are the wire format. They are not the YAML package encoding.
