-- ==========================================================
-- SISTEMA DE BIBLIOTECA - MySQL 8.0+
-- Criação e população inicial do banco de dados
-- ==========================================================

CREATE DATABASE IF NOT EXISTS sistema_biblioteca
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sistema_biblioteca;

-- Tabela de livros
CREATE TABLE IF NOT EXISTS livro (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    titulo VARCHAR(200) NOT NULL,
    autor VARCHAR(150) NOT NULL,
    isbn VARCHAR(20) NULL,
    ano_publicacao SMALLINT UNSIGNED NULL,
    quantidade_exemplares INT UNSIGNED NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_livro_isbn (isbn),
    CONSTRAINT chk_livro_quantidade CHECK (quantidade_exemplares >= 0),
    CONSTRAINT chk_livro_ano CHECK (ano_publicacao IS NULL OR ano_publicacao BETWEEN 1 AND 9999)
) ENGINE=InnoDB;

-- Tabela de empréstimos; nome do leitor fica registrado diretamente
-- no empréstimo, conforme o diagrama ER do protótipo.
CREATE TABLE IF NOT EXISTS emprestimo (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    livro_id INT UNSIGNED NOT NULL,
    nome_leitor VARCHAR(150) NOT NULL,
    data_emprestimo DATE NOT NULL,
    data_prevista_devolucao DATE NOT NULL,
    data_devolucao DATE NULL,
    PRIMARY KEY (id),
    KEY idx_emprestimo_livro (livro_id),
    KEY idx_emprestimo_leitor (nome_leitor),
    KEY idx_emprestimo_prevista (data_prevista_devolucao),
    CONSTRAINT fk_emprestimo_livro
        FOREIGN KEY (livro_id) REFERENCES livro(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_emprestimo_datas CHECK (
        data_prevista_devolucao >= data_emprestimo
        AND (data_devolucao IS NULL OR data_devolucao >= data_emprestimo)
    )
) ENGINE=InnoDB;

-- População inicial de livros. ON DUPLICATE KEY evita duplicar ISBNs
-- quando o script for executado novamente.
INSERT INTO livro (titulo, autor, isbn, ano_publicacao, quantidade_exemplares) VALUES
('Dom Casmurro', 'Machado de Assis', '9788535910663', 1899, 4),
('O Cortiço', 'Aluísio Azevedo', '9788535910664', 1890, 3),
('Capitães da Areia', 'Jorge Amado', '9788535910665', 1937, 5),
('A Hora da Estrela', 'Clarice Lispector', '9788535910666', 1977, 2),
('O Pequeno Príncipe', 'Antoine de Saint-Exupéry', '9788595081512', 1943, 6),
('1984', 'George Orwell', '9788535914849', 1949, 3),
('A Revolução dos Bichos', 'George Orwell', '9788535909555', 1945, 4),
('Harry Potter e a Pedra Filosofal', 'J. K. Rowling', '9788532511010', 1997, 5),
('O Hobbit', 'J. R. R. Tolkien', '9788578277109', 1937, 2),
('Quarto de Despejo', 'Carolina Maria de Jesus', '9788508171279', 1960, 3)
ON DUPLICATE KEY UPDATE
    titulo = VALUES(titulo),
    autor = VALUES(autor),
    ano_publicacao = VALUES(ano_publicacao),
    quantidade_exemplares = VALUES(quantidade_exemplares);

-- Empréstimos de demonstração. Datas relativas a CURRENT_DATE:
-- há empréstimos ativos, um atrasado e alguns já devolvidos.
-- A subconsulta encontra os livros pelo ISBN para não depender dos IDs.
INSERT INTO emprestimo
    (livro_id, nome_leitor, data_emprestimo, data_prevista_devolucao, data_devolucao)
SELECT l.id, dados.nome_leitor, dados.data_emprestimo,
       dados.data_prevista_devolucao, dados.data_devolucao
FROM (
    SELECT '9788535910663' AS isbn, 'Ana Souza' AS nome_leitor,
           DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY) AS data_emprestimo,
           DATE_ADD(CURRENT_DATE, INTERVAL 9 DAY) AS data_prevista_devolucao,
           CAST(NULL AS DATE) AS data_devolucao
    UNION ALL SELECT '9788535910665', 'Bruno Lima',
           DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY),
           DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY),
           CAST(NULL AS DATE)
    UNION ALL SELECT '9788595081512', 'Carla Mendes',
           DATE_SUB(CURRENT_DATE, INTERVAL 12 DAY),
           DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY),
           DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY)
    UNION ALL SELECT '9788535914849', 'Diego Alves',
           DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY),
           DATE_ADD(CURRENT_DATE, INTERVAL 11 DAY),
           CAST(NULL AS DATE)
    UNION ALL SELECT '9788508171279', 'Elisa Costa',
           DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY),
           DATE_SUB(CURRENT_DATE, INTERVAL 16 DAY),
           DATE_SUB(CURRENT_DATE, INTERVAL 15 DAY)
) AS dados
JOIN livro AS l ON l.isbn = dados.isbn
WHERE NOT EXISTS (
    SELECT 1
    FROM emprestimo AS e
    WHERE e.livro_id = l.id
      AND e.nome_leitor = dados.nome_leitor
      AND e.data_emprestimo = dados.data_emprestimo
);

-- Consultas para conferir os dados inseridos
SELECT * FROM livro ORDER BY id;

SELECT e.id, l.titulo, e.nome_leitor, e.data_emprestimo,
       e.data_prevista_devolucao, e.data_devolucao,
       CASE
           WHEN e.data_devolucao IS NOT NULL THEN 'Devolvido'
           WHEN e.data_prevista_devolucao < CURRENT_DATE THEN 'Atrasado'
           ELSE 'Em andamento'
       END AS situacao
FROM emprestimo AS e
JOIN livro AS l ON l.id = e.livro_id
ORDER BY e.id;
