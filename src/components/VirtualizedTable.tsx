import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Array<{
    header: string;
    accessorKey: string | ((row: T) => React.ReactNode);
    className?: string;
    cellClassName?: (row: T) => string;
  }>;
  minRows?: number;
  maxHeight?: number;
}

export function VirtualizedTable<T extends Record<string, any>>({
  data,
  columns,
  minRows = 5,
  maxHeight = 600,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: Math.max(data.length, minRows),
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 48, []),
    overscan: 5,
    paddingStart: 16,
    paddingEnd: 16,
  });

  return (
    <div ref={parentRef} style={{ maxHeight: `${maxHeight}px`, overflow: "auto" }}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={i} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            return (
              <TableRow
                key={virtualRow.index}
                data-index={virtualRow.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map((col, i) => {
                  const value =
                    typeof col.accessorKey === "function"
                      ? col.accessorKey(row)
                      : row[col.accessorKey];
                  return (
                    <TableCell
                      key={i}
                      className={
                        typeof col.cellClassName === "function"
                          ? col.cellClassName(row)
                          : col.className
                      }
                    >
                      {value ?? "—"}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
