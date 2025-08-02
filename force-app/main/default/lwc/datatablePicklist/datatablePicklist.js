import LightningDatatable from 'lightning/datatable';
import picklistTemplate from './picklistType.html';

export default class DatatablePicklist extends LightningDatatable {
    static customTypes = {
        picklist: {
            template: picklistTemplate,
            standardCellLayout: true,
            typeAttributes: ['options', 'value', 'placeholder', 'context'],
            editTemplate: picklistTemplate
        }
    };

    handlePicklistChange(event) {
        try {
            const value = event.target.value;
            const rowKey = event.target.dataset.context;
            
            // Find the column definition for this cell
            const cellElement = event.target.closest('td');
            const columnIndex = Array.from(cellElement.parentNode.children).indexOf(cellElement);
            const column = this.columns[columnIndex];
            
            if (!column || !column.fieldName) {
                console.error('Could not determine column field name');
                return;
            }

            console.log('Picklist change:', { 
                value, 
                rowKey, 
                fieldName: column.fieldName,
                columnIndex 
            });

            // Create the draft values in the format expected by lightning-datatable
            const draftValues = [{ 
                _id: rowKey, 
                [column.fieldName]: value 
            }];

            // Use setTimeout to avoid immediate event conflicts
            setTimeout(() => {
                this.dispatchEvent(new CustomEvent('cellchange', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        draftValues: draftValues
                    }
                }));
            }, 0);
        } catch (error) {
            console.error('Error in handlePicklistChange:', error);
        }
    }
}