"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@timber/ui";
import type { VisitorsByCountry as VisitorsByCountryType } from "../types";

interface VisitorsByCountryProps {
  data: VisitorsByCountryType[];
}

// Country flag emoji from country code
function getCountryFlag(code: string): string {
  if (code === "UNKNOWN" || !code) return "";
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function VisitorsByCountry({ data }: VisitorsByCountryProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visitors by Country</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No visitor data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Countries</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Visitors</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((country) => (
              <TableRow key={country.countryCode}>
                <TableCell>
                  <span className="mr-2">{getCountryFlag(country.countryCode)}</span>
                  {country.countryName}
                </TableCell>
                <TableCell className="text-right">
                  {country.visitorCount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {country.percentage}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
