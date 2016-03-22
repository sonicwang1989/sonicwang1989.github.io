//递归字段分组
function recursion(d, fields, level) {
    var groups = d.groupBy(fields[level - 1]);
    $.each(groups, function (i, group) {
        group.level = level;
    });
    if (level < fields.length) {
        $.each(groups, function (i, group) {
            groups[i]["children"] = recursion(group.children, fields, group.level + 1);
        });
    }
    return groups;
}


//判断两个对象的属性是否一样
function objIsEqual(a, b, fields) {
    var isEqual = true;
    $.each(fields, function (i, field) {
        isEqual = isEqual && (a[field.value] == b[field.value]);
    });
    return isEqual;
}

//数组分组
Array.prototype.groupBy = function (field) {
    var self = this;
    var groups = [];
    if (self && field) {
        $.each(self, function (i, item) {
            var fieldVal = item[field.value];
            var groupObj = undefined;

            $.each(groups, function (i, item) {
                if (item.field.value == field.value && item.value == fieldVal) {
                    groupObj = item;
                    return false;
                }
            });

            if (groupObj == undefined) {
                groupObj = {
                    field: field,
                    value: fieldVal,
                    children: []
                };
                groups.push(groupObj);
            }
            groupObj.children.push(item);
        });
    }
    return groups;
}

//排序并返回新数组
Array.prototype.sortBy = function (field, order) {
    var func = new Function('a', 'b', 'return a.' + field + ((order == 'asc') ? '>' : '<') + 'b.' + field + '?1:-1');
    return this.concat([]).sort(func);
};

//根据据本地排序
Array.prototype.localeCompare = function (field, order) {
    var func = function (a, b) {
        var va = "" + a[field];
        var vb = "" + b[field];
        var flag = va.localeCompare(vb);
        if (order == "asc") {
            return flag;
        }
        else if (order == "desc") {
            return -flag;
        }
        return 0;
    }
    return this.sort(func);
}

Array.prototype.first = function () {
    if (this && this.length > 0) {
        return this[0];
    }
    return undefined;
};

Array.prototype.clone = function () {
    return Array.prototype.concat(this, []);
};

Array.prototype.last = function () {
    if (this && this.length > 0) {
        return this[this.length - 1];
    }
    return undefined;
};

var CustomReport = function () {
    var self = this;
    self.CustomData = null;//存储自定义数据
    self.AutoFit = true;//是否缩放大小
    //列标题，表格上方
    this.Cols = [];
    //行标题，表格左侧
    this.Rows = [];
    this.Values = [];
    this.Data = [];
    //按行分组后的数据
    this.RowsGroupData = [];
    //按列分组后的数据
    this.ColsGroupData = [];
    this.Vals = [];
    this.InnerColumns = [];
    this.Target = null;
    this.Selector = null;
    this.handle = {};
    //单元格宽度
    this.CellWidth = 120;
    //单元格高度
    this.CellHeight = 40;
    //宽度
    this.Width = 1000;
    //高度
    this.Height = 600;
    this.OriginalWidth = 0;//临时数据的备份
    this.OriginalHeight = 0;//
    this.ScrollbarOffset = 20;//滚动条占用的宽度和高度
    this.ShowSubTotal = true;//是否显示级别统计
    this.ShowTotal = true;//是否显示总计
    this.TotalText = "合计";//总计显示文本
    this.HasInit = false;//是否已经初始化
    this.SortField = null;
    this.SortIndex = -1;
    this.SortOrder = "asc";
    this.BeforeSort = null;
    this.AfterSort = null;
    this.FormatField = function (field, value) {
        return value;
    };

    //检测useragent来初始化一些配置
    this.CheckUserAgent = function () {
        var self = this;
        var ua = window.navigator.userAgent.toLowerCase();
        if (ua.indexOf("ipad") != -1) {
            self.ScrollbarOffset = 3;//ipad中滚动条不占宽度或高度
        }
    };

    //分组数据
    this.GroupData = function () {
        var self = this;
        //对行分组
        var array = recursion(self.Data, self.Rows.concat([]), 1);
        //默认根据Rows里的第一个Field按升序排序
        array = array.localeCompare("value", "asc");
        //添加合计行
        array = self.AddSubTotalRow({ children: array });

        self.RowsGroupData = self.AddTotalRow({ children: array });

        //对列进行分组
        if (self.Cols.length > 0) {
            self.ColsGroupData = recursion(self.Data, self.Cols.concat([]), 1);
        }
    };

    //运用递归给每一级别添加总计行
    this.AddSubTotalRow = function (data) {
        var self = this;

        if (self.ShowSubTotal == false) return data.children;

        var tmp = [];
        var rowLen = self.Rows.length - 1;
        $.each(data.children, function (i, item) {
            var obj = $.extend({}, item);
            if (item.level < rowLen) {
                obj.children = self.AddSubTotalRow(item);
            }
            tmp.push(obj);

            //子节点数量需大于一
            if (item.children && item.children.length > 1) {//item.level == 1 || 
                tmp.push({
                    isSubTotalRow: true,
                    level: item.level,
                    value: item.value + " " + self.TotalText,
                    ref: item
                });
            }
        });
        return tmp;
    };

    //添加总计行
    this.AddTotalRow = function (data) {
        var self = this;

        if (self.ShowTotal == false) return data.children;

        var tmp = data.children.clone();
        tmp.push({
            isTotalRow: true,
            level: 1,
            value: "合计",
            ref: {
                level: 0,
                children: data.children.clone()
            }
        });
        return tmp;
    };

    //按列排序
    this.SortData = function (column, order) {
        var self = this;
        var array = [];
        var func = function (data, col, order) {
            var tmp = [];
            if (data.children) {
                $.each(data.children, function (i, item) {
                    var obj = $.extend({}, item);
                    obj["__total"] = self.CalcTotal(item, col);
                    obj["children"] = func(item, col, order);
                    tmp.push(obj)
                });
                tmp = tmp.sortBy("__total", order);
            }
            return tmp;
        };
        array = recursion(self.Data, self.Rows.concat([]), 1);
        array = func({ children: array }, column, order);//排序字段

        array = self.AddSubTotalRow({ children: array });
        self.RowsGroupData = self.AddTotalRow({ children: array });
        self.Refresh();
    };

    //计算行合并
    this.CalcRowspan = function (data) {
        var self = this;
        var lastField = self.Rows.last();
        var val = 0;

        try {
            if (data.isSubTotalRow == true || data.field.value == lastField.value) {
                val += 1;
            }
            else {
                $.each(data.children, function (i, item) {
                    val += self.CalcRowspan(item);
                });
            }
        } catch (e) {
        }
        return val;
    };

    //计算列合并
    this.CalcColspan = function (data) {
        var self = this;
        var lastField = self.Cols.last();
        var val = 0;
        if (data.field.value == lastField.value) {
            val += self.Vals.length;
        }
        else {
            $.each(data.children, function (i, item) {
                val += self.CalcColspan(item);
            });
        }
        return val;
    };

    this.GetValue = function (data, column) {
        var self = this;
        var ret = 0;
        var rows = data.children;
        var hasCols = self.Cols.length > 0 ? true : false;
        if (rows) {
            $.each(rows, function (i, row) {
                if (objIsEqual(row, column, self.Cols) || hasCols == false) {
                    var val = new Number(row[column["valueField"]]);
                    if (window.isNaN(val)) return true
                    ret += val;
                }
            });
        }
        return ret;
    };

    //获取某列总计
    this.CalcTotal = function (data, column) {
        var self = this;
        var rowCount = self.Rows.length;
        var value = 0;

        if (data.level < rowCount) {
            $.each(data.children, function (i, item) {
                if (item.isSubTotalRow == true) {
                    return true;
                }
                try {
                    value += self.CalcTotal(item, column);
                } catch (e) { }
            });
        }
        else {
            value = self.GetValue(data, column);
        }

        return value;
    };

    //创建左侧的表格
    this.CreateRowsTable = function () {
        var self = this;
        var rowsCount = self.Rows.length;
        var firstField = self.Rows.first();
        var lastField = self.Rows.last();

        //创建左上标题表
        (function () {
            var rowHeaderTable = $("<table></table>");
            $.each(self.Cols, function () {
                var tr = $("<tr></tr>");
                var td = $("<td class='data-cell'></td>");
                td.attr("colspan", rowsCount);
                tr.append(td);
                rowHeaderTable.append(tr);
            });
            var tr = $("<tr class='row-header-title'></tr>");
            $.each(self.Rows, function (i, item) {
                var td = $("<td class='data-cell'></td>");
                td.attr("data-field", item.value).html(item.text);
                tr.append(td);
            });
            rowHeaderTable.append(tr);

            self.Target.find("td.row-header").append(rowHeaderTable);
        })();

        //创建左下数据表
        (function () {
            var rowDataTable = $("<table></table>");
            var func = function (table, data) {
                var tr = table.find("tr.row-header-text:last");
                if (tr.length == 0) {
                    tr = $("<tr class='row-header-text'></tr>");
                    table.append(tr);
                }
                else {
                    if (tr.hasClass("total")) {
                        tr = $("<tr class='row-header-text'></tr>");
                        table.append(tr);
                    }
                }
                var _td = $("<td class='data-cell'></td>");

                if (data.isTotalRow == true) {
                    tr = $("<tr class='row-header-text total'></tr>");
                    _td = $("<td class='data-cell'></td>")
                                    .attr("colspan", rowsCount)
                                    .html(data.value);
                    tr.append(_td);
                    table.append(tr);
                    return;
                }
                else if (data.isSubTotalRow == true) {
                    tr = $("<tr class='row-header-text total'></tr>");
                    _td = $("<td class='data-cell'></td>")
                                    .attr("colspan", rowsCount + 1 - data.level)
                                    .html(data.value);
                    tr.append(_td);
                    table.append(tr);
                    return;
                }
                else {
                    _td.attr("rowspan", self.CalcRowspan(data))
                   .attr("data-field", data.field.value)
                   .data("model", {
                       field: data.field,
                       value: data.value
                   }).html(data.value);

                    if (data.level == 1) {
                        _td.addClass("click_handler");
                    }
                    tr.append(_td);
                }

                if (data.field.value == lastField.value) {
                    $("<tr class='row-header-text aa'></tr>").appendTo(table);
                }
                else {
                    $.each(data.children, function (i, item) {
                        if (item.isTotalRow || item.isSubTotalRow || self.Rows.indexOf(item.field) != -1) {
                            func(table, item);
                        }
                    });
                }
            };
            $.each(self.RowsGroupData, function (i, item) {
                func(rowDataTable, item);
            });
            self.Target.find("td.row-data .wrapper").append(rowDataTable);
        })();
    };

    //创建列表
    this.CreateColumnsTable = function () {
        var self = this;
        var colsCount = self.Cols.length;
        var firstField = self.Cols.first();
        var lastField = self.Cols.last();

        //创建右上标题表
        (function () {
            var colHeaderTable = $("<table></table>");
            var func = function (table, data, colFilter) {
                var tr = table.find(".col-header-title").eq(data.level - 1);
                var td = $("<td class='data-cell'></td>").attr("colspan", self.CalcColspan(data)).html(data.value);
                tr.append(td);

                colFilter[data.field.value] = data.value;
                if (data.field.value == lastField.value) {
                    tr = table.find(".col-header-title:last");
                    $.each(self.Vals, function (i, val) {
                        colFilter["valueField"] = val.value;
                        var innerCol = $.extend({ __index: self.InnerColumns.length }, colFilter);
                        var title = val.text;
                        if (innerCol.__index == self.SortIndex) {
                            title += self.SortOrder == "asc" ? " ↓" : " ↑";
                        }
                        var btn = $("<input type='button' class='sort_handler'>")
                            .attr("data-field", val.value)
                            .data("Column", innerCol)
                            .val(title);
                        td = $("<td class='data-cell sort_handler'></td>");
                        td.append(btn);
                        tr.append(td);

                        self.InnerColumns.push(innerCol);
                    });
                }

                $.each(data.children, function (i, item) {
                    if (data.field && self.Cols.indexOf(data.field) != -1 && data.field.value != lastField.value) {
                        func(table, item, colFilter);
                    }
                });
            };
            $.each(self.Cols, function () {
                var tr = $("<tr class='col-header-title'></tr>");
                colHeaderTable.append(tr);
            });

            //创建数据列 Vals
            $("<tr class='col-header-title'></tr>").appendTo(colHeaderTable);

            if (self.Cols.length > 0) {
                $.each(self.ColsGroupData, function (i, item) {
                    func(colHeaderTable, item, {});
                });
            } else {
                var tr = colHeaderTable.find("tr.col-header-title").last();
                $.each(self.Vals, function (i, val) {
                    var innerCol = {
                        __index: self.InnerColumns.length,
                        valueField: val.value
                    };
                    var title = val.text;
                    if (i == self.SortIndex) {
                        title += self.SortOrder == "asc" ? " ↓" : " ↑";
                    }
                    var btn = $("<input type='button' class='sort_handler'>")
                        .attr("data-field", val.value)
                        .data("Column", innerCol)
                        .val(title)
                    var td = $("<td class='data-cell'></td>");
                    td.append(btn);
                    tr.append(td);
                    self.InnerColumns.push(innerCol);
                });
            }

            self.Target.find("td.col-header .wrapper").append(colHeaderTable);
        })();
    };

    //创建右下主数据区
    this.CreateBody = function () {
        var self = this;
        var firstField = self.Rows.first();
        var lastField = self.Rows.last();

        //填充数据
        (function () {
            var colDataTable = $("<table></table>");

            var func = function (table, data) {
                var tr = $("<tr class='row-data-value'></tr>");
                table.append(tr);
                if (data.isTotalRow == true || data.isSubTotalRow == true) {
                    tr.addClass("total");
                    $.each(self.InnerColumns, function (i, col) {
                        var value = self.CalcTotal(data.ref, col);
                        value = self.FormatField(col,value);
                        var td = $("<td class='data-cell'></td>").html(value);
                        tr.append(td);
                    })
                    return;
                }
                else if (data.field.value == lastField.value) {
                    $.each(self.InnerColumns, function (i, col) {
                        var value = self.GetValue(data, col);
                        value = self.FormatField(col, value);
                        var td = $("<td class='data-cell'></td>").html(value);
                        tr.append(td);
                    })
                }

                $.each(data.children, function (i, item) {
                    if (data.field && data.field.value != lastField.value) {
                        func(table, item);
                    }
                });
            };

            $.each(self.RowsGroupData, function (i, item) {
                func(colDataTable, item);
            });

            self.Target.find("td.col-data .wrapper").append(colDataTable);
        })();
    };

    //创建主布局
    this.CreateLayout = function () {
        var self = this;
        var layout = $("<table class='pivot-layout'>" +
                       "<tr>" +
                           "<td class='row-header'></td>" +
                           "<td class='col-header'>" +
                                "<div class='wrapper no-scroll'>" +
                                "</div>" +
                           "</td>" +
                       "</tr>" +
                       "<tr>" +
                           "<td class='row-data'>" +
                                "<div class='wrapper no-scroll'>" +
                                "</div>" +
                           "</td>" +
                           "<td class='col-data'>" +
                                "<div class='wrapper'>" +
                                "</div>" +
                           "</td>" +
                       "</tr>" +
                      "</table>");
        self.Target.append(layout);
    };

    //算法出现一些问题，暂未想到解决方法，临时通过下面的方法修复
    this.FixIssues = function () {
        self.Target.find("tr:empty").remove();
    };

    this.ReSize = function () {
        var self = this;
        var layout = self.Target.find(".pivot-layout");
        //设置宽高度

        var rowspanTotal = 0;
        var colspanTotal = 0;
        $.each(self.RowsGroupData, function (i, item) {
            rowspanTotal += self.CalcRowspan(item);
        });
        if (self.ShowTotal) {
            rowspanTotal += 1;
        }

        if (self.Cols.length > 0) {
            $.each(self.ColsGroupData, function (i, item) {
                colspanTotal += self.CalcColspan(item);
            });
        } else {
            colspanTotal = self.Vals.length;
        }

        var scrollVisiable = true;//是否显示X轴的滚动条
        //如果表格的长宽小于给定的长宽，则进行适当的缩放
        if (self.AutoFit) {
            var rowCellsCount = self.Rows.length + colspanTotal;//左侧和右侧单元格的总数量
            var rowCellWidth = rowCellsCount * self.CellWidth;//左侧和右侧单元格的总宽度
            if (rowCellWidth < self.Width) {
                self.CellWidth = Math.round(self.Width / rowCellsCount);
            }

            var colCellsCount = self.Cols.length + rowspanTotal;
            var colCellHeight = colCellsCount * self.CellHeight;
            if (colCellHeight + self.ScrollbarOffset < self.Height) {
                self.Height = parseInt(colCellHeight);

                scrollVisiable = false;
            }
        }

        var rowHeaderWidth = self.Rows.length * self.CellWidth;
        var rowHeaderHeight = self.Cols.length * self.CellHeight;
        var colHeaderWidth = self.Width - rowHeaderWidth;
        var rowDataWidth = rowHeaderWidth;
        var rowDataHeight = self.Height - rowHeaderHeight;
        var colDataWidth = colHeaderWidth;

        layout.find("td.row-header").width(rowHeaderWidth);
        layout.find("td.col-header .wrapper").width(colHeaderWidth + self.ScrollbarOffset);
        layout.find("td.col-header .wrapper table").width(colspanTotal * self.CellWidth);
        layout.find("td.col-data .wrapper table").width(colspanTotal * self.CellWidth);

        layout.find("td.col-data .wrapper").css({
            width: colDataWidth + self.ScrollbarOffset + "px",
            height: rowDataHeight + self.ScrollbarOffset + "px"
        });

        layout.find("td.row-data .wrapper").css({
            width: rowDataWidth + "px",
            height: rowDataHeight + "px",
            "padding-bottom": self.ScrollbarOffset + "px"
        });

        if (scrollVisiable == false) {
            layout.find("td.row-data .wrapper").css({
                height: "auto",
                "padding-bottom": "0px"
            });
            layout.find("td.col-data .wrapper").css({
                height: "auto",
            });
        }
    };

    //注册field单击事件
    this.addFieldEvent = function (field, func) {
        var self = this;
        self.handle[field.value] = func;
    }

    this.Init = function () {
        var self = this;
        if (self.HasInit == false) {
            self.CheckUserAgent();

            if (self.Rows.length <= 1) {
                self.ShowSubTotal = false;
            }

            self.OriginalWidth = self.Width;
            self.OriginalHeight = self.Height;
            self.GroupData();
        }
        self.HasInit = true;
    };

    this.Render = function (selector) {
        var self = this;
        self.Init();
        self.Selector = selector;
        self.Target = $("<div></div>").addClass("povittable");

        self.CreateLayout();
        self.CreateRowsTable()
        self.CreateColumnsTable();
        self.CreateBody();
        self.FixIssues();
        self.ReSize();

        $(selector).append(self.Target);

        $(".col-data .wrapper").scroll(function (e) {
            var scroller = $(this);
            var scrollLeft = $(".col-data .wrapper").scrollLeft();
            var scrollWidth = $(".col-data .wrapper").width();
            $(".col-header .wrapper").scrollLeft(scroller.scrollLeft());
            $(".row-data .wrapper").scrollTop(scroller.scrollTop());
        });

        for (var key in self.handle) {
            var func = self.handle[key];
            $(selector).off("click").on("click", ".click_handler[data-field='" + key + "']", function () {
                var _cell = $(this);
                var model = _cell.data("model");
                if ($.isFunction(func)) {
                    func.call(self, model)
                }
            })
        }
        $(selector).find(".sort_handler").off("click").on("click", function () {
            var ele = $(this);
            var col = ele.data("Column");
            var field = ele.attr("data-field");

            ele.attr("disabled", "disabled");

            if (self.SortField == field) {
                self.SortOrder = (self.SortOrder == "asc" ? "desc" : "asc");
            }
            else {
                self.SortField = field;
                self.SortOrder = "asc";
            }

            self.SortIndex = col.__index;
            self.SortData(col, self.SortOrder);
        });

        return;
    };

    this.Refresh = function () {
        var self = this;
        $(self.Selector).empty();
        self.InnerColumns = [];
        self.Width = self.OriginalWidth;
        self.Height = self.OriginalHeight;
        self.Render(self.Selector);
    };

    this.Destory = function () {
        var self = this;
        self.Target.empty();
        self = null;
    };
};