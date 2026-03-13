"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { SearchFilters as SearchFiltersType } from "@/types";

const DAY_OPTIONS = [1, 3, 7, 14, 30, 60] as const;

const COMPANY_TYPES_LIST = [
  { value: "", label: "Any" },
  { value: "ltd", label: "Private limited (ltd)" },
  { value: "plc", label: "Public limited (plc)" },
  { value: "llp", label: "Limited liability partnership (llp)" },
  { value: "private-limited-guarant-nsc-limited-exemption", label: "Private limited (guarant nsc)" },
  { value: "private-unlimited", label: "Private unlimited" },
  { value: "limited-partnership", label: "Limited partnership" },
  { value: "oversea-entity", label: "Overseas entity" },
] as const;

export interface SearchFiltersProps {
  filters: SearchFiltersType;
  onFiltersChange: (f: SearchFiltersType) => void;
  onSearch: () => void;
  isSearching: boolean;
}

export function SearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  isSearching,
}: SearchFiltersProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="size-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Incorporated in the last</Label>
          <Select
            value={String(filters.incorporatedDays)}
            onValueChange={(v) => onFiltersChange({ ...filters, incorporatedDays: Number(v) || 14 })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select days" />
            </SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>SIC codes (comma-separated)</Label>
          <Input
            placeholder="e.g. 62012, 62020"
            value={filters.sicCodes.join(", ")}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                sicCodes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Company type</Label>
          <Select
            value={filters.companyType || "any"}
            onValueChange={(v) => onFiltersChange({ ...filters, companyType: v === "any" || v == null ? "" : v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TYPES_LIST.map(({ value, label }) => (
                <SelectItem key={value || "any"} value={value || "any"}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Registered address keyword</Label>
          <Input
            placeholder="e.g. Surrey, London"
            value={filters.addressKeyword}
            onChange={(e) => onFiltersChange({ ...filters, addressKeyword: e.target.value })}
          />
        </div>

        <Button
          className="w-full"
          onClick={onSearch}
          disabled={isSearching}
        >
          {isSearching ? "Searching…" : "Search"}
        </Button>
      </CardContent>
    </Card>
  );
}
