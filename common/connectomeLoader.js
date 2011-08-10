/*
Copyright (c) 2011, Children's Hospital Boston
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the Children's Hospital Boston nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL CHILDREN'S HOSPITAL BOSTON BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
//
//  connectomeLoader.js
//
//  Description:
//      Provides a loader for Connectome data produced by
//      the Connectome Mapping ToolKit (http://www.cmtk.org)
//
//  Author:
//      Dan Ginsburg (daniel.ginsburg@childrens.harvard.edu)
//      Children's Hospital Boston
//

// Edge on the connectome
ConnectomeEdge = function()
{
    this.nodeIndex0 = 0;
    this.nodeIndex1 = 0;

    this.fiberLengthMean = 0.0;
    this.fiberLengthStd = 0.0;
    this.numberOfFibers = 0;
}


//  Represents the nodes in the connectome
ConnectomeNodesFile = function()
{
    this.numNodes = 0;
    this.nodePositions = null;
}

//  Represents the edges in the connectome
ConnectomeEdgesFile = function()
{
    // List of connectome edges
    this.edgeList = null;

    this.maxNumFibers = 0;
    this.minNumFibers = 10000000;
    this.maxFiberLengthMean = 0.0;
    this.minFiberLengthMean = 10000000.0;
}

ConnectomeLoader = function()
{
}

// Connectome object
ConnectomeLoader.prototype =
{
    // Load a connectome node/edge file set, provide a callback that handles loading
    // the data to WebGL
    load: function(nodesURL, edgesURL, nodesCallback, edgesCallback, object)
    {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function()
        {
            if (xhr.readyState == 4)
            {
                if ( xhr.status == 200 || xhr.status == 0 )
                {
                    ConnectomeLoader.prototype.loadConnectomeNodes( JSON.parse(xhr.responseText), nodesCallback, object );
                }
                else
                {
                    alert( "Couldn't load [" + url + "] [" + xhr.status + "]" );
                }
            }
        }
        xhr.open("GET", nodesURL, true);
        xhr.overrideMimeType("text/plain; charset=x-user-defined");
        xhr.setRequestHeader("Content-Type", "text/plain");
        xhr.send(null);

        var xhr2 = new XMLHttpRequest();
        xhr2.onreadystatechange = function()
        {
            if (xhr2.readyState == 4)
            {
                if ( xhr2.status == 200 || xhr2.status == 0 )
                {
                    ConnectomeLoader.prototype.loadConnectomeEdges( JSON.parse(xhr2.responseText), edgesCallback, object );
                }
                else
                {
                    alert( "Couldn't load [" + url + "] [" + xhr2.status + "]" );
                }
            }
        }
        xhr2.open("GET", edgesURL, true);
        xhr2.overrideMimeType("text/plain; charset=x-user-defined");
        xhr2.setRequestHeader("Content-Type", "text/plain");
        xhr2.send(null);
    },

    // Internal function, load nodes JSON
    loadConnectomeNodes: function(data, callback, object)
    {
        var nodesFile = new ConnectomeNodesFile();

        nodesFile.numNodes = 0;
        for (var node in data)
        {
            nodesFile.numNodes++;
        }

        nodesFile.nodePositions = new Float32Array(nodesFile.numNodes * 3);
        for (var i = 0; i < nodesFile.numNodes; i++)
        {
            nodesFile.nodePositions[i * 3 + 0] = data[i+1].pial_x;
            nodesFile.nodePositions[i * 3 + 1] = data[i+1].pial_y;
            nodesFile.nodePositions[i * 3 + 2] = data[i+1].pial_z;
        }
        
        callback(nodesFile, object);
    },

    // Internal function, load edges JSON
    loadConnectomeEdges: function(data, callback, object)
    {
        var edgesFile = new ConnectomeEdgesFile();
        var numNodes = 0;
        for (var node in data)
        {
            numNodes++;
        }

        edgesFile.edgeList = new Array();
        
        for(var i = 1; i <= numNodes; i++)
        {

            if (data[i] != undefined)
            {
                // Loop only to values greater than i because
                // edges are stored twice and we only need one
                // copy
                for(var j = i; j <= numNodes; j++)
                {
                    // We have a connection between node i <--> j
                    if (data[i][j] != undefined)
                    {
                        var newEdge = new ConnectomeEdge();

                        newEdge.nodeIndex0 = i - 1;
                        newEdge.nodeIndex1 = j - 1;
                        newEdge.fiberLengthMean = data[i][j].fiber_length_mean;
                        newEdge.fiberLengthStd = data[i][j].fiber_length_std;
                        newEdge.numberOfFibers = data[i][j].number_of_fibers;
                        edgesFile.edgeList.push(newEdge);

                        if (newEdge.numberOfFibers > edgesFile.maxNumFibers)
                            edgesFile.maxNumFibers = newEdge.numberOfFibers;

                        if (newEdge.numberOfFibers < edgesFile.minNumFibers)
                            edgesFile.minNumFibers = newEdge.numberOfFibers;

                        if (newEdge.fiberLengthMean > edgesFile.maxFiberLengthMean)
                            edgesFile.maxFiberLengthMean = newEdge.fiberLengthMean;

                        if (newEdge.fiberLengthMean < edgesFile.minFiberLengthMean)
                            edgesFile.minFiberLengthMean = newEdge.fiberLengthMean;
                    }
                }
            }
        }


        callback(edgesFile, object);
    }
    
}

