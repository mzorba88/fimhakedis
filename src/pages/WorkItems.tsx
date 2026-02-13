import { MainLayout } from '@/components/MainLayout';
import { useHakedisStore } from '@/store/hakedisStore';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

interface WorkItemEntry {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  currency: string;
}

export default function WorkItems() {
  const { isLoading } = useSupabaseData();
  const { workEntries } = useHakedisStore();
  const isMobile = useIsMobile();

  const allItems = workEntries
    .filter((e) => e.workItemEntries && (e.workItemEntries as WorkItemEntry[]).length > 0)
    .flatMap((entry) =>
      (entry.workItemEntries as WorkItemEntry[]).map((item) => ({
        ...item,
        contractNo: entry.contractNo,
        subcontractor: entry.subcontractor,
        workCategory: entry.workCategory,
      }))
    );

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Yükleniyor...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">İş Kalemleri</h1>

        {isMobile ? (
          <div className="space-y-3">
            {allItems.map((item, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{item.description}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between"><span>Sözleşme</span><span className="text-foreground font-medium">{item.contractNo}</span></div>
                  <div className="flex justify-between"><span>Taşeron</span><span className="text-foreground">{item.subcontractor}</span></div>
                  <div className="flex justify-between"><span>Kategori</span><span className="text-foreground">{item.workCategory}</span></div>
                  <div className="flex justify-between"><span>Miktar</span><span className="text-foreground">{item.quantity} {item.unit}</span></div>
                  <div className="flex justify-between"><span>Birim Fiyat</span><span className="text-foreground">{item.unitPrice.toLocaleString('tr-TR')} {item.currency}</span></div>
                  <div className="flex justify-between font-semibold"><span>Toplam</span><span className="text-foreground">{(item.quantity * item.unitPrice).toLocaleString('tr-TR')} {item.currency}</span></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sözleşme No</TableHead>
                  <TableHead>Taşeron</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>İş Kalemi</TableHead>
                  <TableHead className="text-right">Miktar</TableHead>
                  <TableHead>Birim</TableHead>
                  <TableHead className="text-right">Birim Fiyat</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                  <TableHead>Para Birimi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.contractNo}</TableCell>
                    <TableCell>{item.subcontractor}</TableCell>
                    <TableCell>{item.workCategory}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity.toLocaleString('tr-TR')}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.unitPrice.toLocaleString('tr-TR')}</TableCell>
                    <TableCell className="text-right font-semibold">{(item.quantity * item.unitPrice).toLocaleString('tr-TR')}</TableCell>
                    <TableCell>{item.currency}</TableCell>
                  </TableRow>
                ))}
                {allItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Henüz iş kalemi bulunmamaktadır.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
