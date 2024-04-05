const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
app.use(express.json());
app.use(cors());


const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'taskdatabase',
    password: '1234',
    port: 5432,
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS usertable (
    uid SERIAL PRIMARY KEY,
    uname VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL,
    pass VARCHAR(50) NOT NULL
  );
`;

const createtaskTable = `
CREATE TABLE IF NOT EXISTS tasktable (
    tid SERIAL PRIMARY KEY,
    tname VARCHAR(40) NOT NULL,
    priorities VARCHAR(10) NOT NULL,
    sdate  DATE NOT NULL,
    edate  DATE NOT NULL,
    status VARCHAR(10) NOT NULL,
    uid INT REFERENCES usertable(uid)
  );`;

const createSubtaskTable = `
CREATE TABLE IF NOT EXISTS subtasktable (
    subTaskId SERIAL PRIMARY KEY,
    subTaskName VARCHAR(40) NOT NULL,
    subTaskPriorities VARCHAR(10) NOT NULL,
    subTaskStartDate  DATE NOT NULL,
    subTaskEndDate  DATE NOT NULL,
    subTaskStatus VARCHAR(10) NOT NULL,
    Tid INT REFERENCES tasktable(tid)
  );`;


// Function to create the 'bank_info' table if it doesn't exist
pool.connect()
    .then(async client => {
        try {
            await client.query(createSubtaskTable);
            return client.release();
        } catch (error) {
            client.release();
            console.error('Error creating table:', error);
        }
    })
    .catch(error => console.error('Error connecting to database:', error));



//insert in login data
app.post('/taskmanager/sigin', async (req, res) => {
    const formData = req.body;
    //console.log("asdfghjkl",typeof formData,formData);
    const datas = await getuserdata("");
    if (datas[0] == 200) {
        if (!datas[1].some(data => data.email == formData.email)) {
            const insertQuery = `INSERT INTO public.usertable( uname, email, pass)
        VALUES ( '${formData.uname}','${formData.email}' , '${formData.pass}');`

            // console.log(insertQuery)
            pool.query(insertQuery)
                .then(() => {
                    res.status(200).send(JSON.stringify('Successfully Registered'));
                })
                .catch(error => {
                    res.status(500).end(JSON.stringify('Error some thing went wrong ', error));
                })
        }
        else {
            res.status(200).send(JSON.stringify('This email is already registered '));
        }
    }
    else {
        res.status(500).end('Error some thing went wrong ');
    }
});

// get login data
app.get('/taskmanager/signin', async (req, res) => {
    const email = req.query.email;
    const where = ` where email='${email}' `
    const data = await getuserdata(where);
    const status = JSON.stringify(data[1])
    res.status(data[0]).end(status)

});

//get task data
app.get('/taskmanager/task', async (req, res) => {
    const uid = req.query.uid;
    const tid = req.query.tid
    let where = `where uid='${uid}'`
    if (tid) {
        where = ` where tid='${tid}' `
    }
    const data = await getAllSubTasks(where)
    const task = JSON.stringify(data[1])

    res.status(data[0]).end(task)
});

//post task data
app.post('/taskmanager/task', async (req, res) => {
    const uid = req.query.uid;
    const taskData = req.body;

    const insertQuery = `INSERT INTO public.tasktable(tname, priorities, sdate, edate, status, uid)
        VALUES ( '${taskData.taskname}', '${taskData.priorities}', '${taskData.startdate}', '${taskData.enddate}', '${taskData.status}', ${uid})  RETURNING *;`

    pool.query(insertQuery)
        .then((result) => {
            res.status(200).end(JSON.stringify(result.rows[0].tid));
        })
        .catch(error => {
            res.status(500).end(JSON.stringify(error));
        })

});

//update task data
app.put('/taskmanager/task', async(req, res) => {
    const tid = req.query.tid;
    const taskData = req.body;
    const where = `WHERE tid=${tid}`

    const update = `UPDATE public.tasktable
	SET  tname='${taskData.taskname}', priorities='${taskData.priorities}', sdate='${taskData.startdate}', edate='${taskData.enddate}', status='${taskData.status}'
	WHERE tid=${tid};`
   
    pool.query(update)
        .then(async () => {
            res.status(200).end(JSON.stringify('successfully updated record '));
        })
        .catch(error => {
            res.status(500).end(JSON.stringify('Error some thing went wrong ', error));
        })

});

//delete task
app.delete('/taskmanager/task', async (req, res) => {
    const tid = req.query.tid;
    const where = `WHERE tid=${tid}`

    const data = await deleteSubtask(where)
    if (data[0] == 200) {
        const deleteQ = `
    DELETE FROM public.tasktable
	WHERE tid=${tid};`
        //console.log(update)
        pool.query(deleteQ)
            .then(() => {
                res.status(200).send(JSON.stringify('Successfully Deleted'));
            })
            .catch(error => {
                res.status(500).end(JSON.stringify('Error some thing went wrong ', error));
            })
    }
    else {
        res.status(500).end(JSON.stringify('Error some thing went wrong ', error));
    }
});

//get subtask by the subTaskId
app.get('/taskmanager/subtask', async (req, res) => {
    const subTaskId = req.query.subTaskId
    const select = `
    SELECT *
	FROM public.subtasktable
    where subtaskid=${subTaskId};`
    const data = await getSubTasks(select)
    const task = JSON.stringify(data[1])

    res.status(data[0]).end(task)
});

//add new subtask
app.post('/taskmanager/subtask', async (req, res) => {
    const tid = req.query.tid;
    const subtaskData = req.body;
   const result= await addSubtask(tid,subtaskData)
    res.status(result[0]).end(result[1]);
});

//delete subtask
app.delete('/taskmanager/subtask', async (req, res) => {
    const subTaskId = req.query.subTaskId;
    const where = `WHERE subtaskid=${subTaskId}`

    const data = await deleteSubtask(where)
    const result = JSON.stringify(data[1])

    res.status(data[0]).end(result)
});

//update subtask
app.put('/taskmanager/subtask', async(req, res) => {
    const subtaskid = req.query.subTaskId
    const subtaskData = req.body;

    const update = `UPDATE public.subtasktable
	SET  subtaskname='${subtaskData.subtaskname}', subtaskpriorities='${subtaskData.subtaskpriorities}', subtaskstartdate='${subtaskData.subtaskstartdate}',
     subtaskenddate='${subtaskData.subtaskenddate}', subtaskstatus='${subtaskData.subtaskstatus}'
	WHERE subtaskid=${subtaskid};`

    pool.query(update)
        .then(() => {
            res.status(200).send(JSON.stringify('Successfully updated the record'));
        })
        .catch(error => {
            res.status(500).end(JSON.stringify('Error some thing went wrong ', error));
        })
    
   
});

    

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});




function getuserdata(where) {
    const select = ` SELECT * FROM public.usertable ${where} ;`
    // console.log(select);
    return new Promise((resolve, reject) => {
        pool.query(select)
            .then(result => {
                const data = result.rows;
                console.log('Fetched data:');
                //  console.log([200, data]);
                resolve([200, data]);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                reject([500, 'Error fetching data']);
            });
    });
}


function gettaskdata(where) {
    const select = ` SELECT * FROM public.tasktable ${where} ;`
    // console.log(select);
    return new Promise((resolve, reject) => {
        pool.query(select)
            .then(result => {
                const data = result.rows;
                // console.log('Fetched data:', data);
                resolve([200, data]);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                reject([500, 'Error fetching data']);
            });
    });
}

function getSubTasks(select) {
    return new Promise((resolve, reject) => {
        pool.query(select)
            .then(result => {
                const subtasks = result.rows;
                //  console.log('Fetched data:', subtasks);
                resolve([200, subtasks]);
            })
            .catch(error => {
                const subtasks = []
                //  console.error('Error fetching data:', error);
                reject([500, subtasks]);
            });
    })
}

function deleteSubtask(where) {
    return new Promise((resolve, reject) => {
        const deleteQ = `
    DELETE FROM public.subtasktable
	${where} ;
    `
        //console.log(update)
        pool.query(deleteQ)
            .then(() => {
                response = JSON.stringify('Successfully Deleted')
                resolve([200, response]);
            })
            .catch(error => {
                reject([500, error])
            })
    });
}

async function getAllSubTasks(where) {
    const datalist = await gettaskdata(where);

    for (const element of datalist[1]) {
        element.subTasks = [];
        const select = `
        SELECT subtaskid, subtaskname, subtaskpriorities, subtaskstartdate, subtaskenddate, subtaskstatus
        FROM public.subtasktable
        WHERE tid=${element.tid};`;
        const subtasks = await getSubTasks(select);
        element.subTasks = subtasks[1]
        datalist.push(element);
    }
    return ([200, datalist[1]]);
}

function addSubtask(tid,subtaskData) {
    return new Promise((resolve, reject) => {
        const insertQuery = `    INSERT INTO public.subtasktable(
            subtaskname, subtaskpriorities, subtaskstartdate, subtaskenddate, subtaskstatus, tid)
            VALUES ( '${subtaskData.subtaskname}', '${subtaskData.subtaskpriorities}', '${subtaskData.subtaskstartdate}', 
            '${subtaskData.subtaskenddate}', '${subtaskData.subtaskstatus}', ${tid});`
        
        pool.query(insertQuery)
            .then(() => {
                resolve([200,JSON.stringify('Data Sucessfully Inserted')])
            })
            .catch(error => {
             reject([500,JSON.stringify(error)]);
            })
        })
    }


// const select = `
// SELECT *
// FROM tasktable LEFT OUTER JOIN subtasktable  ON tasktable.tid =subtasktable .tid
// where tasktable.uid=9;
//  `
