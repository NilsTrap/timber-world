"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import { Monitor, Smartphone, Tablet, HelpCircle } from "lucide-react";
import type { DeviceBreakdown, BrowserBreakdown } from "../types";

interface DeviceBreakdownChartProps {
  devices: DeviceBreakdown[];
  browsers: BrowserBreakdown[];
}

function getDeviceIcon(deviceType: string) {
  switch (deviceType) {
    case "desktop":
      return <Monitor className="h-5 w-5 text-muted-foreground" />;
    case "mobile":
      return <Smartphone className="h-5 w-5 text-muted-foreground" />;
    case "tablet":
      return <Tablet className="h-5 w-5 text-muted-foreground" />;
    default:
      return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
  }
}

export function DeviceBreakdownChart({ devices, browsers }: DeviceBreakdownChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device & Browser</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* Devices */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Devices</h4>
            <div className="space-y-3">
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                devices.map((device) => (
                  <div key={device.deviceType} className="flex items-center gap-3">
                    {getDeviceIcon(device.deviceType)}
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{device.deviceType}</span>
                        <span className="text-muted-foreground">{device.percentage}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded mt-1 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${device.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Browsers */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Browsers</h4>
            <div className="space-y-2">
              {browsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                browsers.slice(0, 5).map((browser) => (
                  <div key={browser.browser} className="flex justify-between text-sm">
                    <span>{browser.browser}</span>
                    <span className="text-muted-foreground">
                      {browser.count.toLocaleString()} ({browser.percentage}%)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
