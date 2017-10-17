import 'slickgrid/slick.grid.css';
import 'slickgrid/slick-default-theme.css';
import 'slickgrid/lib/jquery.event.drag-2.3.0';
import 'slickgrid/slick.core';
import 'slickgrid/slick.grid';
import 'slickgrid/slick.dataview';
import 'slickgrid/slick.groupitemmetadataprovider';
import 'slickgrid/plugins/slick.cellselectionmodel';
import 'slickgrid/plugins/slick.cellrangeselector';
import 'slickgrid/plugins/slick.cellrangedecorator';
import 'slickgrid';

class RemoteLoader {
    constructor(endpoint_url, num_alignments) {
        this.endpoint_url = endpoint_url;
        this.num_alignments = num_alignments;
        this.on_data_loaded = new Slick.Event();
        this.last_result = null;

        this.group_meta_provider = new Slick.Data.GroupItemMetadataProvider();
        this.data_view = new Slick.Data.DataView({
            groupItemMetadataProvider: this.group_meta_provider,
            inlineFilters: true
        });
        this.data_view.present = new Set();
    }

    load_results(after=null) {
        let url = new URL(this.endpoint_url, window.location)
        if(after !== null){
            url.searchParams.set("after", this.last_result.structure_id)
        }

        return fetch(url).then((response) => {
            return response.json();
        }).then((data) => {
            if(data.length > 0){
                this.data_view.beginUpdate();
                for(let item of data){
                    if(!this.data_view.present.has(item["structure_id"])){
                        item["id"] = item["structure_id"];
                        this.data_view.addItem(item);
                        this.data_view.present.add(item["structure_id"]);
                        this.last_result = item;
                    }
                }
                this.data_view.endUpdate();
                this.on_data_loaded.notify();
            }
            return data;
        })
    }

    load_bottom() {
        return this.load_results(this.last_result)
    }

    load_all(callback) {
        this.load_bottom().then((results) => {
            if(results.length > 0){
                this.load_all(callback);
            }
        });
    }
};

function aln_img_formatter(row, cell, value, columnDef, dataContext) {
    if(dataContext.aln_img !== null) {
        return `<img src="${dataContext.aln_img}">`;
    }
    return '';
};

let grid, loader;
const slick_columns = [
  {id: "name", name: "Name", field: "name", width: 150},
  {id: "cluster_index", name: "Cluster", field: "cluster_index", width: 150},
  {id: "child_index", name: "Child", field: "child_index", width: 150},
  {id: "tm1", name: "TM (query)", field: "tm1", width: 100},
  {id: "tm2", name: "TM (hit)", field: "tm2", width: 100},
  {id: "aln_img", name: "Alignment", field: "aln_img", formatter: aln_img_formatter, width: 280},
];
const slick_options = {
  enableCellNavigation: false,
  enableColumnReorder: false
};

function update_progressbar(retrieved, total) {
    let percent = retrieved / total * 100;
    $("#load-bar > .progress-bar")
        .css("width", percent + "%")
        .attr({"aria-valuenow": percent});
}


class RepresentativeAggregator {
    init() {
        this.representative = null;
    }

    accumulate(item) {
        if(this.representative === null && item["child_index"] === null){
            this.representative = item;
        }
    }

    storeResult(groupTotals) {
      groupTotals.representative = this.representative;
    }
  }


function comparer(a, b) {
    var x = a["tm1"], y = b["tm2"];
    return (x == y ? 0 : (x > y ? 1 : -1));
}


function init_grouping(data_view, grid) {
    data_view.setGrouping({
        collapsed: true,
        getter: "cluster_index",
        lazyTotalsCalculation: false,
        comparer: comparer,
        aggregators: [
            new Slick.Data.Aggregators.Max("tm1"),
            new Slick.Data.Aggregators.Min("tm1"),
            new RepresentativeAggregator(),
          ],
        formatter: (g) => {
            let min = g.totals.min.tm1;
            let max = g.totals.max.tm1;
            let rep = g.totals.representative;
            return `${rep.name} (${g.count} children) TM: ${min}&ndash;${max}`;
        },
    });
}


export function init_grid(params) {
    loader = new RemoteLoader(params.endpoint_url, params.num_alignments);
    grid = new Slick.Grid(params.element, loader.data_view, slick_columns, slick_options);
    grid.setSelectionModel(new Slick.CellSelectionModel());
    grid.registerPlugin(loader.group_meta_provider);

    loader.data_view.onRowCountChanged.subscribe(function (e, args) {
        grid.updateRowCount();
        grid.render();
    });
    loader.data_view.onRowsChanged.subscribe(function (e, args) {
      grid.invalidateRows(args.rows);
      grid.render();
    });
    init_grouping(loader.data_view, grid);

    loader.on_data_loaded.subscribe((event) => {
        grid.updateRowCount();
        grid.render();

        // Load more data if we haven't filled the grid yet.
        let vp = grid.getViewport();
        if(vp.bottom >= loader.data_view.getLength()){
            loader.load_bottom();
        }

        // Update progressbar
        update_progressbar(loader.data_view.getLength(), loader.num_alignments);
    });
    loader.load_bottom();

    grid.onViewportChanged.subscribe((e, args) => {
        // Load more data if we have hit the bottom of the grid.
        let vp = grid.getViewport();
        if(vp.bottom >= loader.data_view.getLength()){
            loader.load_bottom();
        }
    });

    $("#download-all").click(() => {
        loader.load_all(update_progressbar);
    });
}
