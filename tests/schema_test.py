import pathlib
import re
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
QUERY = re.search(r'catalogQuery=`(.*?)`', (ROOT / 'functions/_shared/catalog-query.ts').read_text(), re.S).group(1)

class MarketplaceSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.executescript((ROOT / 'migrations/0001_marketplace.sql').read_text())
        for identity, status in [('approved', 'approved'), ('pending', 'pending'), ('suspended', 'suspended')]:
            self.db.execute('INSERT INTO marketplace_sellers(id,display_name,status) VALUES(?,?,?)', (identity, 'Anunciante de teste', status))

    def listing(self, seller='approved', status='published', price=1000, category='Casa', title='Produto para teste'):
        self.db.execute('INSERT INTO marketplace_listings(seller_id,title,description,price_cents,category,condition,fulfillment,status) VALUES(?,?,?,?,?,?,?,?)', (seller, title, 'Descrição de teste com detalhes', price, category, 'Usado', 'A combinar', status))

    def test_catalogo_so_expoe_publicados_de_vendedores_aprovados(self):
        for seller in ['approved', 'pending', 'suspended']:
            for status in ['pending', 'published', 'paused', 'sold', 'rejected', 'removed']:
                self.listing(seller, status)
        records = self.db.execute(QUERY).fetchall()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['status'], 'PUBLICADO')

    def test_rejeita_precos_invalidos_e_produto_sem_preco(self):
        for price in [0, -1, 1.5, 100000001, None]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.listing(price=price)
        self.listing(price=None, category='Serviços')

    def test_rejeita_orfao_e_titulo_vazio(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.listing(seller='ausente')
        with self.assertRaises(sqlite3.IntegrityError):
            self.listing(title='     ')

    def test_migracao_nao_semeia_dados_e_pode_ser_reexecutada(self):
        self.db.executescript((ROOT / 'migrations/0001_marketplace.sql').read_text())
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM marketplace_listings').fetchone()[0], 0)

    def tearDown(self):
        self.db.close()

if __name__ == '__main__':
    unittest.main()
