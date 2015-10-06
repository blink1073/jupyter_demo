
This is a proof on concept demonstration of integrating the refactoring work
on the Jupyter Notebook with Phosphor widgets.  It is not meant to be a fully
functional notebook.  Future development will occur in jupyter/notebook and 
related jupyter repositories.  Enjoy!


To install:

```
npm install 
npm run build
```

Requires the development version of Jupyter Notebook:

`pip install git+https://github.com/jupyter/notebook`

To run the demo, start a notebook server by insuring that cross origin access is set up correctly :

`jupyter notebook --NotebookApp.allow_origin='http://localhost:8765'`

Then run the demo server. 

`python main.py`


Demo:

<img alt="Phosphor Demo" width="600px" src="phosphor_demo.gif"></img>
