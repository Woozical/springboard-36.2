process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('./app');
const db = require('./db');
const Book = require('./models/book');

const testBook = {
    "isbn": "0691161518",
    "amazon_url": "http://a.co/eobPtX2",
    "author": "Matthew Lane",
    "language": "english",
    "pages": 264,
    "publisher": "Princeton University Press",
    "title": "Power-Up: Unlocking the Hidden Mathematics in Video Games",
    "year": 2017
};

const testBook2 = {...testBook};
testBook2.isbn = "032316967";

beforeEach(async () => {
    // seed testing data
    await Book.create(testBook);
    await Book.create(testBook2);
});

afterEach(async () => {
    // clear testing db
    await db.query('DELETE FROM books');
});

afterAll(async () => {
    // close db connection
    await db.end();
});

describe('GET /books', () => {
    test('Should return an array of all books in db', async () => {
        const res = await request(app).get('/books');
        expect(res.statusCode).toBe(200);
        expect(res.body.books).toEqual([testBook, testBook2]);
    });
});

describe('GET /books/:isbn', () => {
    test('Should return book data based on for given isbn', async () => {
        const res = await request(app).get(`/books/${testBook.isbn}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.book).toEqual(testBook);
    });
    test('Should respond with 404 on invalid isbn', async () => {
        const res = await request(app).get('/books/123');
        expect(res.statusCode).toBe(404);
    });
});

describe('POST /books', () => {
    test('Should create a new book with given request data', async () => {
        const data = {
            "isbn": "12345",
            "amazon_url": "http://amazon.com/123",
            "author": "Booker Page",
            "language": "english",
            "pages": 101,
            "publisher": "Penguin",
            "title": "Writing 101",
            "year": 1999
        };
        const res = await request(app).post('/books').send(data);
        expect(res.statusCode).toBe(201);
        expect(res.body.book).toEqual(data);
        const query = await db.query('SELECT * FROM books WHERE isbn = $1', [data.isbn]);
        const dbData = query.rows[0];
        expect(dbData).toEqual(data);
    });
    test('Should respond with 400 if request body is missing required from schema', async () => {
        const missing = {'isbn' : '12345', "author" : "Writerman", "pages" : 200}
        const res = await request(app).post('/books').send(missing);
        expect(res.statusCode).toBe(400);

        // Should not create in DB
        const query = await db.query('SELECT * FROM books WHERE isbn = $1', [missing.isbn]);
        expect(query.rowCount).toBe(0);
    });
    test('Should respond with 400 if request body types do not match schema', async () => {
        const wrongTypes = {...testBook, isbn : "12345", pages : "two hundred"};
        const res = await request(app).post('/books').send(wrongTypes);
        expect(res.statusCode).toBe(400);
        // Should not update DB
        const query = await db.query('SELECT * FROM books WHERE isbn = $1', [wrongTypes.isbn]);
        expect(query.rowCount).toBe(0);
    });
    test('Should respond with 400 if request body ISBN already exists in db', async () => {
        const res = await request(app).post('/books').send(testBook);
        expect(res.statusCode).toBe(400);
    });
});

describe('PUT /books/:isbn', () => {
    test('Should update book with new request data', async () => {
        const data = {...testBook2, isbn: testBook.isbn};
        const res = await request(app).put(`/books/${testBook.isbn}`).send(data);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.book).toEqual(data);
        const query = await db.query('SELECT * FROM books WHERE isbn = $1', [testBook.isbn]);
        const dbData = query.rows[0];
        expect(dbData).toEqual(data);
    });
    test('Should respond with 404 if no isbn found in db', async () => {
        const data = {...testBook2};
        const res = await request(app).put('/books/0000').send(data);
        expect(res.statusCode).toBe(404);
    });
    test('Should respond with 400 if request body is missing required from schema', async () => {
        const missing = {'isbn' : testBook.isbn, "author" : "Writerman", "pages" : 200}
        const res = await request(app).put(`/books/${testBook.isbn}`).send(missing);
        expect(res.statusCode).toBe(400);

        // Should not update DB
        const query = await db.query('SELECT * FROM books WHERE isbn = $1', [testBook.isbn]);
        const dbData = query.rows[0];
        expect(dbData.author).not.toEqual(missing.author);
        expect(dbData.author).toEqual(testBook.author);
    });
    test('Should respond with 400 if request body types do not match schema', async () => {
        const wrongTypes = {...testBook, pages: "two hundred"}
        const res = await request(app).put(`/books/${testBook.isbn}`).send(wrongTypes);
        expect(res.statusCode).toBe(400);

        // Should not update DB
        const query = await db.query('SELECT * FROM books WHERE isbn = $1', [testBook.isbn]);
        const dbData = query.rows[0];
        expect(dbData.pages).not.toEqual(wrongTypes.pages);
        expect(dbData.pages).toEqual(testBook.pages);
    });
});

describe('DELETE /books/:isbn', () => {
    test('Should delete book with given isbn from the db', async () => {
        const res = await request(app).delete(`/books/${testBook.isbn}`);
        expect(res.statusCode).toBe(200);
        const query = await db.query('SELECT * FROM books WHERE isbn = $1', [testBook.isbn]);
        expect(query.rowCount).toBe(0);
    });
    test('Should respond with 404 if isbn not in db', async () => {
        const res = await request(app).delete('/books/0001234');
        expect(res.statusCode).toBe(404);
    })
});
